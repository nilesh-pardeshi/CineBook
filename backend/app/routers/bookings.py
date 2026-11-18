import re
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import now_local, settings
from ..database import get_db
from ..deps import get_current_user
from ..layout import seat_key, seat_map
from ..models import Booking, BookingFood, BookingSeat, Coupon, FoodItem, Show, User
from ..schemas import BookingCreate, CouponApply, FoodUpdate, PayIn
from ..services import (
    booking_dict, cancel_booking_with_refund, coupon_check, new_ref, recalc_booking,
    release_booking_seats, release_expired,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _load(db: Session, ref: str, user: User) -> Booking:
    b = db.scalar(select(Booking).where(Booking.ref == ref.upper()))
    if not b or (b.user_id != user.id and user.role != "admin"):
        raise HTTPException(404, "Booking not found")
    return b


def _load_pending(db: Session, ref: str, user: User) -> Booking:
    """A booking the user can still modify: pending and with a live seat hold."""
    release_expired(db)
    b = _load(db, ref, user)
    if b.user_id != user.id:
        raise HTTPException(403, "Not your booking")
    if b.status == "EXPIRED":
        raise HTTPException(410, "Your seat hold expired. Please select seats again.")
    if b.status != "PENDING":
        raise HTTPException(400, f"This booking is already {b.status.lower()}")
    return b


@router.post("", status_code=201)
def create_booking(data: BookingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    release_expired(db)
    show = db.get(Show, data.show_id)
    if not show or not show.is_active:
        raise HTTPException(404, "Show not found")
    if show.start_time <= now_local():
        raise HTTPException(400, "This show has already started")

    labels = list(dict.fromkeys(s.strip().upper() for s in data.seats))
    if len(labels) > settings.MAX_SEATS:
        raise HTTPException(400, f"You can book at most {settings.MAX_SEATS} seats at a time")
    smap = seat_map(show.screen)
    bad = [l for l in labels if l not in smap]
    if bad:
        raise HTTPException(400, f"Invalid seat(s): {', '.join(bad)}")

    # Drop this user's earlier unpaid hold on the same show so they can re-pick seats.
    for old in db.scalars(
        select(Booking).where(Booking.user_id == user.id, Booking.show_id == show.id, Booking.status == "PENDING")
    ).all():
        old.status = "EXPIRED"
        release_booking_seats(db, old)
    db.flush()

    b = Booking(
        ref=new_ref(),
        user_id=user.id,
        show_id=show.id,
        status="PENDING",
        seats=",".join(sorted(labels, key=seat_key)),
        expires_at=now_local() + timedelta(minutes=settings.SEAT_HOLD_MINUTES),
    )
    for label in labels:
        cat = smap[label]
        b.seat_rows.append(BookingSeat(show_id=show.id, label=label, category=cat, price=show.price_for(cat)))
    recalc_booking(db, b)
    db.add(b)
    try:
        db.commit()  # unique(show_id, label) rejects seats someone else grabbed first
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Sorry, one or more of those seats were just taken. Please pick different seats.")
    return booking_dict(b)


@router.get("/mine")
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    release_expired(db)
    rows = db.scalars(
        select(Booking)
        .where(Booking.user_id == user.id, Booking.status.in_(["CONFIRMED", "CANCELLED"]))
        .order_by(Booking.created_at.desc())
    ).all()
    return [booking_dict(b) for b in rows]


@router.get("/{ref}")
def get_booking(ref: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    release_expired(db)
    return booking_dict(_load(db, ref, user))


@router.put("/{ref}/food")
def set_food(ref: str, data: FoodUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _load_pending(db, ref, user)
    wanted = {}
    for line in data.items:
        if line.qty > 0:
            wanted[line.food_id] = line.qty
    items = {f.id: f for f in db.scalars(select(FoodItem).where(FoodItem.id.in_(wanted.keys()), FoodItem.is_active == True))} if wanted else {}  # noqa: E712
    if len(items) != len(wanted):
        raise HTTPException(400, "One of the food items is no longer available")
    b.food_rows.clear()
    db.flush()
    for fid, qty in wanted.items():
        b.food_rows.append(BookingFood(food_id=fid, name=items[fid].name, qty=qty, unit_price=items[fid].price))
    notice = recalc_booking(db, b)
    db.commit()
    return {**booking_dict(b), "notice": notice}


@router.post("/{ref}/coupon")
def apply_coupon(ref: str, data: CouponApply, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _load_pending(db, ref, user)
    res, err = coupon_check(db, data.code, b.seat_total + b.food_total, user.id)
    if err:
        raise HTTPException(400, err)
    b.coupon_code = res[0].code
    recalc_booking(db, b)
    db.commit()
    return booking_dict(b)


@router.delete("/{ref}/coupon")
def remove_coupon(ref: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _load_pending(db, ref, user)
    b.coupon_code = None
    recalc_booking(db, b)
    db.commit()
    return booking_dict(b)


def _luhn_ok(number: str) -> bool:
    digits = [int(d) for d in number][::-1]
    total = sum(digits[0::2]) + sum(sum(divmod(d * 2, 10)) for d in digits[1::2])
    return total % 10 == 0


def _validate_payment(p: PayIn) -> str:
    """Validates the payment details and returns a short, safe description (never full card numbers)."""
    if p.method == "card":
        num = re.sub(r"[\s-]", "", p.card_number or "")
        if not (num.isdigit() and 13 <= len(num) <= 19 and _luhn_ok(num)):
            raise HTTPException(400, "Enter a valid card number")
        m = re.fullmatch(r"(\d{2})\s*/\s*(\d{2})", (p.card_expiry or "").strip())
        if not m or not (1 <= int(m.group(1)) <= 12):
            raise HTTPException(400, "Enter card expiry as MM/YY")
        now = now_local()
        if (2000 + int(m.group(2)), int(m.group(1))) < (now.year, now.month):
            raise HTTPException(400, "This card has expired")
        if not re.fullmatch(r"\d{3,4}", (p.card_cvv or "").strip()):
            raise HTTPException(400, "Enter a valid CVV")
        if num.endswith("0002"):  # sandbox rule: cards ending 0002 are declined
            raise HTTPException(402, "Payment declined by the bank. Try another card or payment method.")
        return f"Card ending {num[-4:]}"
    if p.method == "upi":
        upi = (p.upi_id or "").strip()
        if not re.fullmatch(r"[\w.\-]{2,}@[A-Za-z]{2,}", upi):
            raise HTTPException(400, "Enter a valid UPI ID (e.g. name@bank)")
        if upi.lower().startswith("fail@"):  # sandbox rule
            raise HTTPException(402, "UPI payment failed. Please try again.")
        return f"UPI {upi}"
    if p.method == "netbanking":
        if not (p.bank or "").strip():
            raise HTTPException(400, "Select your bank")
        return f"Netbanking {p.bank}"
    if not (p.wallet or "").strip():
        raise HTTPException(400, "Select a wallet")
    return f"Wallet {p.wallet}"


@router.post("/{ref}/pay")
def pay(ref: str, data: PayIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sandbox payment: validates details and confirms the booking. Swap the body of this
    function for Razorpay/Stripe order verification to go live (see README)."""
    release_expired(db)
    b = _load(db, ref, user)
    if b.user_id != user.id:
        raise HTTPException(403, "Not your booking")
    if b.status == "CONFIRMED":
        return booking_dict(b)
    if b.status == "EXPIRED":
        raise HTTPException(410, "Your seat hold expired. Please select seats again.")
    if b.status != "PENDING":
        raise HTTPException(400, f"This booking is already {b.status.lower()}")
    if b.show.start_time <= now_local():
        raise HTTPException(400, "This show has already started")

    detail = _validate_payment(data)

    if b.coupon_code:  # re-validate right before charging, then count the use
        res, err = coupon_check(db, b.coupon_code, b.seat_total + b.food_total, user.id)
        if err:
            b.coupon_code = None
            recalc_booking(db, b)
            db.commit()
            raise HTTPException(400, f"{err}. The price has been updated, please review and pay again.")
        coupon = db.get(Coupon, res[0].id)
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            raise HTTPException(400, "Coupon usage limit reached")
        coupon.used_count += 1

    b.status = "CONFIRMED"
    b.payment_method = data.method
    b.payment_detail = detail
    b.payment_ref = "PAY" + secrets.token_hex(5).upper()
    b.paid_at = now_local()
    b.expires_at = None
    db.commit()
    return booking_dict(b)


@router.post("/{ref}/cancel")
def cancel(ref: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    release_expired(db)
    b = _load(db, ref, user)
    if b.user_id != user.id:
        raise HTTPException(403, "Not your booking")
    if b.status == "PENDING":
        b.status = "CANCELLED"
        b.cancel_reason = "Cancelled before payment"
        release_booking_seats(db, b)
    elif b.status == "CONFIRMED":
        if b.checked_in:
            raise HTTPException(400, "This ticket has already been used")
        if b.show.start_time - now_local() < timedelta(hours=settings.CANCEL_CUTOFF_HOURS):
            raise HTTPException(
                400, f"Tickets can only be cancelled up to {settings.CANCEL_CUTOFF_HOURS} hours before the show"
            )
        cancel_booking_with_refund(db, b, "Cancelled by customer")
    else:
        raise HTTPException(400, f"This booking is already {b.status.lower()}")
    db.commit()
    return booking_dict(b)
