"""Supported protocol implementations."""

from os import path, listdir, getcwd, chdir
from importlib import import_module

PROTOCOLS = set(
    map(
        lambda x: path.splitext(x)[0],
        filter(lambda x: not x.startswith("_") and path.splitext(x)[-1] == ".py",
               listdir(path.abspath(path.dirname(__file__))))))
_rest, PROTOCOLS_PACKAGE = path.split(path.abspath(path.dirname(__file__)))
_, APP_PACKAGE = path.split(_rest)
FULL_PACKAGE = "{}.{}".format(APP_PACKAGE, PROTOCOLS_PACKAGE)

def get_protocols():
    """Get all protocols."""
    protocols = {}
    for protocol in PROTOCOLS:
        protocols[protocol] = import_module("." + protocol, FULL_PACKAGE)
    return protocols
