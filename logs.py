#!/usr/bin/env python3
"""Generic event log functions and classes."""

from dataclasses import dataclass
from hashlib import sha1
from typing import (Any, Dict, Iterator, List, Optional, Type, TypeVar, Union, cast)
from os import path, listdir

# Can't do below definition as recursive types aren't supported by mypy yet (tm)
# EntryDictTypeValue = Union[Dict[str, "EntryDictTypeValue"], List["EntryDictTypeValue"], str, int, float]
# EntryDictType = Dict[str, EntryDictTypeValue]
# This is a simplistic definition but should be sufficient, if restrictive
EntryDictType = Dict[str, Union[Optional[str], Dict[str, Union[int, str]],
                                Union[str, int, float, List[Union[str, int, float]]]]]


@dataclass
class Entry:
    """A generic log entry."""

    time: float
    value: str

    def to_dict(self) -> EntryDictType:
        """Convert JSON compatible to dictionary."""
        return {"time": self.time, "value": self.value}

    def __hash__(self) -> int:
        """Hash comparison."""
        return hash(str(self.time) + "|" + self.value)

    def get_id(self) -> str:
        """Get the ID of this event."""
        return sha1((str(self.time) + "|" + self.value).encode("utf-8")).hexdigest()


def read_log_file(file: str, entry_type: Optional[Type] = None) -> Any:
    """Read generic log entries from a log file."""
    if entry_type is None:
        entry_type = Entry  # type: ignore
    assert entry_type is not None
    assert issubclass(entry_type, Entry)
    with open(file, "r") as file_handle:
        for line in file_handle:
            line = line.strip()
            if line.startswith("#"):
                continue
            time, *rest = line.split(" ")
            yield entry_type(time=float(time), value=" ".join(rest))


def read_log_files(folder: str, entry_type: Optional[Type] = None) -> Any:
    """Read generic log entries from a log folder."""
    for file in filter(lambda x: path.splitext(x)[-1] == ".log", listdir(folder)):
        yield from read_log_file(path.join(folder, file), entry_type)
