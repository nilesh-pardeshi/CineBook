"""Seat layout helpers. Row A is the front row; the last rows are the premium / recliner rows."""
import string

ROW_LETTERS = string.ascii_uppercase


def row_category(screen, i: int) -> str:
    regular = screen.rows - screen.premium_rows - screen.recliner_rows
    if i < regular:
        return "regular"
    if i < regular + screen.premium_rows:
        return "premium"
    return "recliner"


def seat_map(screen) -> dict:
    """label -> category for every seat on the screen."""
    return {
        f"{ROW_LETTERS[i]}{n}": row_category(screen, i)
        for i in range(screen.rows)
        for n in range(1, screen.cols + 1)
    }


def seat_key(label: str):
    return (label[0], int(label[1:]))
