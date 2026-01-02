"""
Admin API endpoints for Best Wishes.
Only accessible to users with is_admin=1 in the database.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from auth_utils import get_current_user_id
from database import (
    is_user_admin,
    get_all_users,
    get_all_cards,
    get_admin_stats
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(user_id: int = Depends(get_current_user_id)) -> int:
    """Dependency that checks if the current user is an admin."""
    if not is_user_admin(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user_id


@router.get("/stats")
async def admin_stats(user_id: int = Depends(require_admin)):
    """Get admin dashboard statistics."""
    return get_admin_stats()


@router.get("/users")
async def admin_users(page: int = 1, per_page: int = 20, user_id: int = Depends(require_admin)):
    """Get paginated users."""
    return get_all_users(page, per_page)


@router.get("/cards")
async def admin_cards(page: int = 1, per_page: int = 20, user_id: int = Depends(require_admin)):
    """Get paginated cards across all users."""
    return get_all_cards(page, per_page)
