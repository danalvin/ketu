from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_roundtrip():
    password = "StrongPass123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_access_token_type_and_subject():
    token = create_access_token({"sub": "test-user-id"})
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == "test-user-id"
    assert payload["type"] == "access"


def test_refresh_token_type_and_subject():
    token = create_refresh_token({"sub": "test-user-id"})
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == "test-user-id"
    assert payload["type"] == "refresh"
