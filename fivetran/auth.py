"""
DocuSign Authentication and Token Management

This module handles DocuSign JWT authentication and access token generation
for the Fivetran connector.
"""

import jwt
import requests
import time
import os
from typing import Dict

REQUIRED_AUTH_CONFIG_KEYS = ("integration_key", "user_id", "oauth_base_url")
PRIVATE_KEY_CONFIG_KEY = "private_key"
DEFAULT_PRIVATE_KEY_FILENAME = "private_key"


def _ensure_auth_config(configuration: dict) -> None:
    """Ensure all required authentication configuration values are present."""
    missing_values = []
    for key in REQUIRED_AUTH_CONFIG_KEYS:
        raw_value = configuration.get(key)
        if raw_value is None:
            missing_values.append(key)
            continue

        normalized_value = str(raw_value).strip()
        if not normalized_value:
            missing_values.append(key)
            continue

        configuration[key] = normalized_value

    if missing_values:
        raise Exception(
            "Missing required DocuSign configuration values: " + ", ".join(missing_values)
        )


def _load_private_key(configuration: dict) -> str:
    """Load the DocuSign private key from configuration or file."""
    inline_key = configuration.get(PRIVATE_KEY_CONFIG_KEY)
    if inline_key:
        inline_key = str(inline_key).strip()
        if inline_key:
            return inline_key

    private_key_path = configuration.get("private_key_path") or DEFAULT_PRIVATE_KEY_FILENAME
    if not os.path.isabs(private_key_path):
        base_dir = os.path.dirname(__file__)
        private_key_path = os.path.join(base_dir, private_key_path)

    if not os.path.exists(private_key_path):
        raise Exception(
            f"DocuSign private key file not found at '{private_key_path}'."
        )

    with open(private_key_path, "r", encoding="utf-8") as key_file:
        return key_file.read()


def _exchange_jwt_for_access_token(oauth_base_url: str, jwt_assertion: str) -> str:
    """Exchange JWT assertion for DocuSign access token."""
    token_url = f"https://{oauth_base_url}/oauth/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt_assertion,
    }

    response = requests.post(token_url, headers=headers, data=data, timeout=30)
    response.raise_for_status()
    token = response.json().get("access_token")

    if not token:
        raise Exception("DocuSign token response did not include 'access_token'.")

    return token


def _refresh_access_token(configuration: dict) -> str:
    """Fetch a fresh DocuSign access token using JWT Grant flow."""
    _ensure_auth_config(configuration)
    private_key = _load_private_key(configuration)

    now = int(time.time())
    payload = {
        "iss": configuration["integration_key"],
        "sub": configuration["user_id"],
        "iat": now,
        "exp": now + 28800,  # 8 hours
        "aud": configuration["oauth_base_url"],
        "scope": "signature impersonation",
    }

    jwt_assertion = jwt.encode(payload, private_key, algorithm="RS256")
    if isinstance(jwt_assertion, bytes):
        jwt_assertion = jwt_assertion.decode("utf-8")

    token = _exchange_jwt_for_access_token(configuration["oauth_base_url"], jwt_assertion)
    configuration["access_token"] = token
    return token


def _mask_token(token: str, visible_characters: int = 6) -> str:
    """Mask a token for safe logging, showing only the last few characters."""
    if not token:
        return ""
    return f"...{token[-visible_characters:]}" if len(token) > visible_characters else token


def main():
    """
    Main function for testing the authentication module independently.
    This function demonstrates how to use the authentication functions.
    """
    import sys

    print("DocuSign Authentication Module Test")
    print("=" * 40)

    # Example configuration (replace with actual values for testing)
    test_config = {
        "integration_key": "your_integration_key_here",
        "user_id": "your_user_id_here",
        "oauth_base_url": "account-d.docusign.com",  # Demo environment
        "private_key_path": "private_key"  # Path to your private key file
    }

    print("Test Configuration:")
    print(f"  Integration Key: {test_config['integration_key']}")
    print(f"  User ID: {test_config['user_id']}")
    print(f"  OAuth Base URL: {test_config['oauth_base_url']}")
    print(f"  Private Key Path: {test_config['private_key_path']}")
    print()

    try:
        # Test configuration validation
        print("Testing configuration validation...")
        _ensure_auth_config(test_config)
        print("✓ Configuration validation passed")
        print()

        # Test private key loading
        print("Testing private key loading...")
        private_key = _load_private_key(test_config)
        print(f"✓ Private key loaded successfully (length: {len(private_key)} characters)")
        print()

        # Test token generation
        print("Testing access token generation...")
        access_token = _refresh_access_token(test_config)
        masked_token = _mask_token(access_token)
        print(f"✓ Access token generated successfully: {masked_token}")
        print()

        print("All tests passed! The authentication module is working correctly.")
        print("\nNote: This was a test run. In production, use your actual DocuSign credentials.")

    except Exception as e:
        print(f"✗ Test failed with error: {e}")
        print("\nTo run this test successfully:")
        print("1. Replace the test_config values with your actual DocuSign credentials")
        print("2. Ensure your private key file exists at the specified path")
        print("3. Make sure you have internet connection for OAuth token exchange")
        sys.exit(1)


if __name__ == "__main__":
    main()