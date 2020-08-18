#!/usr/bin/env python3
"""Generic event log functions and classes."""

from dataclasses import dataclass
from typing import Iterator, Optional, Type, TypeVar, Dict, Union, List
from hashlib import sha1

# Can't do below definition as recursive types aren't supported by mypy yet (tm)
# EntryDictTypeValue = Union[Dict[str, "EntryDictTypeValue"], List["EntryDictTypeValue"], str, int, float]
# EntryDictType = Dict[str, EntryDictTypeValue]
# This is a simplistic definition but should be sufficient, if restrictive
EntryDictType = Dict[str, Union[Dict[str, Union[int, str]], Union[str, int, float,
                                                                  List[Union[str, int, float]]]]]


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


T = TypeVar("T", bound=Entry)


def read_log_file(file: str, entry_type: Optional[Type[T]] = None) -> Iterator[T]:
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
