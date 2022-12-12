import re

import grpc


class XrayError(Exception):
    REGEXP = ...

    def __init__(self, details):
        self.details = details


class EmailExistsError(XrayError):
    REGEXP = re.compile(r"User (.*) already exists.")

    def __init__(self, details, email):
        self.email = email
        super().__init__(details)


class EmailNotFoundError(XrayError):
    REGEXP = re.compile(r"User (.*) not found.")

    def __init__(self, details, email):
        self.email = email
        super().__init__(details)


class TagNotFoundError(XrayError):
    REGEXP = re.compile(r"handler not found: (.*)")

    def __init__(self, details, tag):
        self.tag = tag
        super().__init__(details)


class ConnectionError(XrayError):
    REGEXP = re.compile(r"Failed to connect to remote host|Socket closed|Broken pipe")

    def __init__(self, details, tag):
        self.tag = tag
        super().__init__(details)


class UnkownError(XrayError):
    def __init__(self, details=''):
        super().__init__(details)


class RelatedError(XrayError):
    def __new__(cls, error: grpc.RpcError):
        details = error.details()
        for e in (EmailExistsError, EmailNotFoundError, TagNotFoundError, ConnectionError):
            args = e.REGEXP.findall(details)
            if not args:
                continue

            return e(details, *args)

        return UnkownError(details)
