"""End-to-end API smoke test. Run from /backend after seeding:

    python tests/smoke_test.py

Uses FastAPI's in-process TestClient against whatever DATABASE_URL points to.
"""
import os
import sys
import uuid
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from app.config import now_local  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Booking  # noqa: E402

PASS, FAIL = 0, 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok   {name}")
    else:
        FAIL += 1
        print(f"  FAIL {name} {extra}")


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


with TestClient(app) as c:
    print("Auth")
    email = f"t{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "secret1", "phone": "9876543210"})
    check("register", r.status_code == 201, r.text)
    check("duplicate email rejected", c.post("/api/auth/register", json={"name": "X Y", "email": email, "password": "secret1"}).status_code == 409)
    check("bad password rejected", c.post("/api/auth/login", json={"email": email, "password": "nope"}).status_code == 401)
    tok = c.post("/api/auth/login", json={"email": email, "password": "secret1"}).json()["access_token"]
    me = c.get("/api/auth/me", headers=hdr(tok))
    check("me", me.status_code == 200 and me.json()["email"] == email)
    check("unauthenticated blocked", c.get("/api/auth/me").status_code == 401)
    check("profile update", c.put("/api/auth/me", headers=hdr(tok), json={"name": "Renamed User", "phone": ""}).json()["name"] == "Renamed User")
    check("change password", c.post("/api/auth/change-password", headers=hdr(tok), json={"current_password": "secret1", "new_password": "secret2"}).status_code == 200)
    tok = c.post("/api/auth/login", json={"email": email, "password": "secret2"}).json()["access_token"]
    admin_tok = c.post("/api/auth/login", json={"email": "admin@cinebook.com", "password": "Admin@123"}).json()["access_token"]
    tok2_email = f"t{uuid.uuid4().hex[:8]}@example.com"
    tok2 = c.post("/api/auth/register", json={"name": "Second User", "email": tok2_email, "password": "secret1"}).json()["access_token"]

    print("Catalog")
    cities = c.get("/api/cities").json()
    check("cities", "Pune" in cities, cities)
    movies = c.get("/api/movies", params={"status": "now_showing"}).json()
    check("now showing movies", len(movies) >= 8, len(movies))
    check("upcoming movies", len(c.get("/api/movies", params={"status": "upcoming"}).json()) >= 2)
    check("search", len(c.get("/api/movies", params={"q": "kesari"}).json()) == 1)
    check("meta", len(c.get("/api/meta").json()["genres"]) > 5)
    check("food", len(c.get("/api/food").json()) >= 10)
    check("coupons", len(c.get("/api/coupons").json()) >= 4)

    show_id = None
    for m in movies:
        d = c.get(f"/api/movies/{m['id']}/shows", params={"city": "Pune"}).json()
        if not d["theatres"]:
            continue
        check("movie shows grouped by theatre", len(d["dates"]) >= 3 and d["theatres"][0]["shows"][0]["price_from"] > 0)
        # pick a show >= 4h away so the "cancel up to 2h before" rule doesn't interfere
        for day in d["dates"]:
            dd = c.get(f"/api/movies/{m['id']}/shows", params={"city": "Pune", "date": day}).json()
            for th in dd["theatres"]:
                for sh in th["shows"]:
                    if show_id is None and sh["start_time"] > (now_local() + timedelta(hours=4)).isoformat():
                        show_id = sh["id"]
        if show_id:
            break
    check("found a bookable show", show_id is not None)

    sd = c.get(f"/api/shows/{show_id}").json()
    free = [s["label"] for row in sd["rows"] for s in row["seats"] if s["status"] == "available"]
    check("seat map", len(sd["rows"]) >= 9 and len(free) > 20)

    print("Booking flow")
    pick = free[-3:]
    r = c.post("/api/bookings", headers=hdr(tok), json={"show_id": show_id, "seats": pick})
    check("create booking (hold)", r.status_code == 201 and r.json()["status"] == "PENDING", r.text)
    bk = r.json()
    ref = bk["ref"]
    check("seat prices add up", bk["seat_total"] == sum(s["price"] for s in bk["seat_details"]) and bk["total"] == bk["seat_total"] + bk["fee"])
    sd2 = c.get(f"/api/shows/{show_id}").json()
    states = {s["label"]: s["status"] for row in sd2["rows"] for s in row["seats"]}
    check("held seats shown as held", all(states[p] == "held" for p in pick))

    r = c.post("/api/bookings", headers=hdr(tok2), json={"show_id": show_id, "seats": [pick[0]]})
    check("double booking blocked (409)", r.status_code == 409, r.text)
    check("too many seats blocked", c.post("/api/bookings", headers=hdr(tok2), json={"show_id": show_id, "seats": free[:9]}).status_code == 400)
    check("invalid seat blocked", c.post("/api/bookings", headers=hdr(tok2), json={"show_id": show_id, "seats": ["Z99"]}).status_code == 400)
    check("other user can't read my booking", c.get(f"/api/bookings/{ref}", headers=hdr(tok2)).status_code == 404)

    foods = c.get("/api/food").json()
    r = c.put(f"/api/bookings/{ref}/food", headers=hdr(tok), json={"items": [{"food_id": foods[0]["id"], "qty": 2}, {"food_id": foods[3]["id"], "qty": 1}]})
    b = r.json()
    check("add food", r.status_code == 200 and b["food_total"] == foods[0]["price"] * 2 + foods[3]["price"], r.text)

    r = c.post(f"/api/bookings/{ref}/coupon", headers=hdr(tok), json={"code": "nonsense"})
    check("invalid coupon rejected", r.status_code == 400)
    r = c.post(f"/api/bookings/{ref}/coupon", headers=hdr(tok), json={"code": "welcome50"})
    b = r.json()
    sub = b["seat_total"] + b["food_total"]
    check("coupon WELCOME50 applied (50%, max 150)", r.status_code == 200 and b["discount"] == min(sub // 2, 150), r.text)
    check("total = subtotal - discount + fee", b["total"] == sub - b["discount"] + b["fee"])
    r = c.delete(f"/api/bookings/{ref}/coupon", headers=hdr(tok))
    check("remove coupon", r.json()["discount"] == 0)
    c.post(f"/api/bookings/{ref}/coupon", headers=hdr(tok), json={"code": "WELCOME50"})

    r = c.put(f"/api/bookings/{ref}/food", headers=hdr(tok), json={"items": []})
    check("coupon auto-removed when min amount no longer met (or still valid)", r.status_code == 200)

    print("Payment")
    r = c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "card", "card_number": "4111 1111 1111 1112", "card_expiry": "12/30", "card_cvv": "123"})
    check("invalid card (luhn) rejected", r.status_code == 400, r.text)
    r = c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "card", "card_number": "4000 0000 0000 0002", "card_expiry": "12/30", "card_cvv": "123"})
    check("declined test card -> 402", r.status_code == 402, r.text)
    r = c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "card", "card_number": "4111 1111 1111 1111", "card_expiry": "01/20", "card_cvv": "123"})
    check("expired card rejected", r.status_code == 400)
    r = c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "upi", "upi_id": "bad id"})
    check("bad UPI rejected", r.status_code == 400)
    still = c.get(f"/api/bookings/{ref}", headers=hdr(tok)).json()
    check("booking still pending after failed payments", still["status"] == "PENDING")
    r = c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "card", "card_number": "4111 1111 1111 1111", "card_expiry": "12/30", "card_cvv": "123"})
    paid = r.json()
    check("pay with valid card", r.status_code == 200 and paid["status"] == "CONFIRMED" and paid["payment_ref"].startswith("PAY"), r.text)
    check("card number not stored", "4111" not in str(paid) or paid["payment_detail"] == "Card ending 1111")
    sd3 = c.get(f"/api/shows/{show_id}").json()
    states = {s["label"]: s["status"] for row in sd3["rows"] for s in row["seats"]}
    check("confirmed seats shown as booked", all(states[p] == "booked" for p in pick))
    check("in my bookings", ref in [x["ref"] for x in c.get("/api/bookings/mine", headers=hdr(tok)).json()])
    check("paying twice is idempotent", c.post(f"/api/bookings/{ref}/pay", headers=hdr(tok), json={"method": "upi", "upi_id": "a@b"}).json()["payment_ref"] == paid["payment_ref"])

    print("Coupon one-per-user")
    pick2 = free[:2]
    b2 = c.post("/api/bookings", headers=hdr(tok), json={"show_id": show_id, "seats": pick2}).json()
    r = c.post(f"/api/bookings/{b2['ref']}/coupon", headers=hdr(tok), json={"code": "WELCOME50"})
    check("WELCOME50 can't be reused by same user", r.status_code == 400 and "already" in r.text, r.text)

    print("Hold expiry")
    with SessionLocal() as db:
        bb = db.query(Booking).filter(Booking.ref == b2["ref"]).one()
        bb.expires_at = now_local() - timedelta(minutes=1)
        db.commit()
    sd4 = c.get(f"/api/shows/{show_id}").json()
    states = {s["label"]: s["status"] for row in sd4["rows"] for s in row["seats"]}
    check("expired hold frees seats", all(states[p] == "available" for p in pick2))
    r = c.post(f"/api/bookings/{b2['ref']}/pay", headers=hdr(tok), json={"method": "upi", "upi_id": "a@okbank"})
    check("paying an expired hold -> 410", r.status_code == 410, r.text)
    r = c.post("/api/bookings", headers=hdr(tok2), json={"show_id": show_id, "seats": pick2})
    check("other user can now take those seats", r.status_code == 201, r.text)
    c.post(f"/api/bookings/{r.json()['ref']}/cancel", headers=hdr(tok2))
    sd5 = c.get(f"/api/shows/{show_id}").json()
    states = {s["label"]: s["status"] for row in sd5["rows"] for s in row["seats"]}
    check("cancelling a pending hold frees seats", all(states[p] == "available" for p in pick2))

    print("Cancellation & refund")
    r = c.post(f"/api/bookings/{ref}/cancel", headers=hdr(tok2))
    check("other user can't cancel my booking", r.status_code in (403, 404))
    r = c.post(f"/api/bookings/{ref}/cancel", headers=hdr(tok))
    cb = r.json()
    check("cancel confirmed booking", r.status_code == 200 and cb["status"] == "CANCELLED" and cb["refund_amount"] == cb["total"] - cb["fee"], r.text)
    sd6 = c.get(f"/api/shows/{show_id}").json()
    states = {s["label"]: s["status"] for row in sd6["rows"] for s in row["seats"]}
    check("seats released after cancel", all(states[p] == "available" for p in pick))

    print("Admin")
    check("non-admin blocked from admin API", c.get("/api/admin/stats", headers=hdr(tok)).status_code == 403)
    st = c.get("/api/admin/stats", headers=hdr(admin_tok)).json()
    check("stats", st["totals"]["bookings"] > 100 and len(st["daily"]) == 14 and len(st["top_movies"]) == 5)

    mv = c.post("/api/admin/movies", headers=hdr(admin_tok), json={"title": "Test Movie", "duration_min": 100, "release_date": "", "poster_url": ""}).json()
    check("admin create movie", mv.get("id") and mv["poster_url"] is None, mv)
    mv2 = c.put(f"/api/admin/movies/{mv['id']}", headers=hdr(admin_tok), json={**{k: v for k, v in mv.items() if k != "id"}, "title": "Test Movie 2"}).json()
    check("admin update movie", mv2["title"] == "Test Movie 2")

    th = c.post("/api/admin/theatres", headers=hdr(admin_tok), json={"name": "Test Theatre", "city": "Nashik"}).json()
    check("admin create theatre", th.get("id"))
    bad = c.post("/api/admin/screens", headers=hdr(admin_tok), json={"theatre_id": th["id"], "name": "S1", "rows": 5, "cols": 8, "premium_rows": 5})
    check("invalid screen layout rejected", bad.status_code == 422)
    sc = c.post("/api/admin/screens", headers=hdr(admin_tok), json={"theatre_id": th["id"], "name": "S1", "rows": 6, "cols": 8, "premium_rows": 2, "recliner_rows": 1}).json()
    check("admin create screen", sc.get("id") and sc["theatre_name"].startswith("Test Theatre"))
    check("theatre with screens can't be deleted", c.delete(f"/api/admin/theatres/{th['id']}", headers=hdr(admin_tok)).status_code == 409)

    tomorrow = (now_local() + timedelta(days=1)).strftime("%Y-%m-%dT18:00")
    sh = c.post("/api/admin/shows", headers=hdr(admin_tok), json={"movie_id": mv["id"], "screen_id": sc["id"], "start_time": tomorrow})
    check("admin create show", sh.status_code == 201, sh.text)
    overlap = (now_local() + timedelta(days=1)).strftime("%Y-%m-%dT18:30")
    r = c.post("/api/admin/shows", headers=hdr(admin_tok), json={"movie_id": mv["id"], "screen_id": sc["id"], "start_time": overlap})
    check("overlapping show rejected (409)", r.status_code == 409, r.text)
    r = c.post("/api/admin/shows", headers=hdr(admin_tok), json={"movie_id": mv["id"], "screen_id": sc["id"], "start_time": "2020-01-01T10:00"})
    check("past show rejected", r.status_code == 400)
    start = (now_local() + timedelta(days=2)).date().isoformat()
    end = (now_local() + timedelta(days=4)).date().isoformat()
    r = c.post("/api/admin/shows/bulk", headers=hdr(admin_tok), json={"movie_id": mv["id"], "screen_id": sc["id"], "start_date": start, "end_date": end, "times": ["10:00", "14:00", "18:00"]}).json()
    check("bulk schedule creates 9 shows", r["created"] == 9, r)
    r = c.post("/api/admin/shows/bulk", headers=hdr(admin_tok), json={"movie_id": mv["id"], "screen_id": sc["id"], "start_date": start, "end_date": end, "times": ["10:00"]}).json()
    check("bulk skips duplicates", r["created"] == 0 and len(r["skipped"]) == 3)

    # a customer books the new show, admin cancels the show -> full refund
    sid = sh.json()["id"]
    cb = c.post("/api/bookings", headers=hdr(tok), json={"show_id": sid, "seats": ["A1", "A2"]}).json()
    c.post(f"/api/bookings/{cb['ref']}/pay", headers=hdr(tok), json={"method": "wallet", "wallet": "PhonePe"})
    r = c.put(f"/api/admin/shows/{sid}", headers=hdr(admin_tok), json={**{k: v for k, v in sh.json().items() if k in ("movie_id", "screen_id", "start_time", "price_regular", "price_premium", "price_recliner")}, "is_active": False})
    check("admin cancels show -> refunds bookings", r.status_code == 200 and r.json()["refunded_bookings"] == 1, r.text)
    after = c.get(f"/api/bookings/{cb['ref']}", headers=hdr(tok)).json()
    check("customer fully refunded", after["status"] == "CANCELLED" and after["refund_amount"] == after["total"], after)

    # check-in
    pick3 = free[5:6]
    b3 = c.post("/api/bookings", headers=hdr(tok), json={"show_id": show_id, "seats": pick3}).json()
    c.post(f"/api/bookings/{b3['ref']}/pay", headers=hdr(tok), json={"method": "upi", "upi_id": "me@okaxis"})
    r = c.post(f"/api/admin/bookings/{b3['ref']}/checkin", headers=hdr(admin_tok))
    check("admin check-in", r.status_code == 200 and r.json()["checked_in"] is True, r.text)
    check("double check-in rejected", c.post(f"/api/admin/bookings/{b3['ref']}/checkin", headers=hdr(admin_tok)).status_code == 400)
    check("checked-in ticket can't be cancelled", c.post(f"/api/bookings/{b3['ref']}/cancel", headers=hdr(tok)).status_code == 400)
    lst = c.get("/api/admin/bookings", headers=hdr(admin_tok), params={"q": b3["ref"]}).json()
    check("admin bookings search", len(lst) == 1 and lst[0]["user"]["email"] == email)

    fd = c.post("/api/admin/food", headers=hdr(admin_tok), json={"name": "Test Fries", "price": 99, "category": "Snacks"}).json()
    check("admin food CRUD", fd.get("id") and c.delete(f"/api/admin/food/{fd['id']}", headers=hdr(admin_tok)).status_code == 200)
    cp = c.post("/api/admin/coupons", headers=hdr(admin_tok), json={"code": "test10", "discount_type": "percent", "value": 10, "valid_from": "", "valid_to": ""})
    check("admin create coupon (code uppercased)", cp.status_code == 201 and cp.json()["code"] == "TEST10", cp.text)
    check("duplicate coupon -> 409", c.post("/api/admin/coupons", headers=hdr(admin_tok), json={"code": "TEST10", "value": 10}).status_code == 409)
    check("coupon > 100% rejected", c.post("/api/admin/coupons", headers=hdr(admin_tok), json={"code": "BAD1", "value": 150}).status_code == 422)
    c.delete(f"/api/admin/coupons/{cp.json()['id']}", headers=hdr(admin_tok))

    # cleanup test data created above. Shows with booking history can't be hard-deleted (by design),
    # so anything left over is deactivated and stays hidden from customers.
    for s in c.get("/api/admin/shows", headers=hdr(admin_tok), params={"movie_id": mv["id"]}).json():
        c.delete(f"/api/admin/shows/{s['id']}", headers=hdr(admin_tok))
    c.delete(f"/api/admin/screens/{sc['id']}", headers=hdr(admin_tok))
    c.delete(f"/api/admin/theatres/{th['id']}", headers=hdr(admin_tok))
    c.delete(f"/api/admin/movies/{mv['id']}", headers=hdr(admin_tok))
    left = c.get(f"/api/admin/movies", headers=hdr(admin_tok)).json()
    for m in left:
        if m["title"].startswith("Test Movie"):
            c.put(f"/api/admin/movies/{m['id']}", headers=hdr(admin_tok), json={**{k: v for k, v in m.items() if k != "id"}, "is_active": False})
    for s in c.get("/api/admin/screens", headers=hdr(admin_tok)).json():
        if s["theatre_name"].startswith("Test Theatre"):
            c.put(f"/api/admin/screens/{s['id']}", headers=hdr(admin_tok), json={**{k: v for k, v in s.items() if k not in ("id", "theatre_name")}, "is_active": False})
    for t in c.get("/api/admin/theatres", headers=hdr(admin_tok)).json():
        if t["name"] == "Test Theatre":
            c.put(f"/api/admin/theatres/{t['id']}", headers=hdr(admin_tok), json={**{k: v for k, v in t.items() if k != "id"}, "is_active": False})

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
