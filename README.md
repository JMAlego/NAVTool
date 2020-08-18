# Network Analysis and Visualisation Tool

A tool for the analysis and visualisation of networking protocols. Developed to support the analysis of an implementation of [AirTight](https://github.com/JMAlego/AirTight).

## Introduction

This project aims to create a simple to use tool for the analysis and visualisation of network communication. The aim is to be protocol independent, though the tool was developed with small real-time and/or embedded networks in mind (specifically AirTight).

This implementation is currently rather simplistic and needs reorganisation and additions to make it more protocol independent, ideally with more protocols implemented.

## Running

Create a virtual Python 3 environment and install the modules from requirements.txt.

Run the project as a module: `python3 -m NAVTool <DATA PATH>`.

A data path argument is required which is a path to where the data to be analysed can be found.

## AirTight Support

The AirTight protocol support includes:

- Log viewing
- Packet decoding
- Network graph visualisation
- Log validation rules
- Timeline view
- Slot table inspection

AirTight notifications are not currently supported, so synchronisation and other faults are not able to be inspected.

Observation analysis is possible, though limited compared to log analysis.

## License

This project is licensed under the BSD 3-Clause license, see [LICENSE](LICENSE) for details.
