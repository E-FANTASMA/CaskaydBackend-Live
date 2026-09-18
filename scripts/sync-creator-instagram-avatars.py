import json
import os
import sys

import instaloader


def fetch_profile_pic(username, should_download=True):
    loader = instaloader.Instaloader(
        quiet=True,
        max_connection_attempts=1,
    )

    login = os.getenv("INSTALOADER_LOGIN", "").strip()
    session_file = os.getenv("INSTALOADER_SESSIONFILE", "").strip()
    if session_file and not os.path.isabs(session_file):
        session_file = os.path.join(os.getcwd(), session_file)

    if login and session_file and os.path.exists(session_file):
        loader.load_session_from_file(login, session_file)

    print(f"Fetching profile information for @{username}...")
    profile = instaloader.Profile.from_username(loader.context, username)

    print(f"Profile Pic URL: {profile.profile_pic_url}")
    if should_download:
        print(f"Downloading profile picture for @{username}...")
        loader.download_profile(username, profile_pic_only=True)
        print("Done!")

    return profile.profile_pic_url


def parse_args(argv):
    args = {
        "username": "thecuteabiola",
        "json": False,
        "skip_download": False,
    }

    for value in argv:
        if value == "--json":
            args["json"] = True
            continue

        if value == "--skip-download":
            args["skip_download"] = True
            continue

        args["username"] = value

    return args


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])

    try:
        profile_pic_url = fetch_profile_pic(
            args["username"],
            should_download=not args["skip_download"],
        )

        if args["json"]:
            print(
                json.dumps(
                    {
                        "username": args["username"],
                        "profile_pic_url": str(profile_pic_url),
                    }
                )
            )
    except Exception as error:
        if args["json"]:
            print(json.dumps({"error": str(error), "username": args["username"]}))
        raise
