# Network Analysis and Visualisation Tool

A tool for the analysis and visualisation of networking protocols. Developed to support the analysis of an implementation of [AirTight](https://github.com/JMAlego/AirTight).

## Introduction

This project aims to create a simple to use tool for the analysis and visualisation of network communication. The aim is to be protocol independent, though the tool was developed with small real-time and/or embedded networks in mind (specifically AirTight).

This implementation is currently rather simplistic and needs reorganisation and additions to make it more protocol independent, ideally with more protocols implemented.

## Setting-Up & Running

### Setting-Up Using a Virtual Environment

#### Windows

```bat
git clone https://github.com/JMAlego/NAVTool.git
cd NAVTool
python3 -m venv .venv
.\.venv\Scripts\activate.bat
pip install -r requirements.txt
```

#### Linux

```sh
git clone https://github.com/JMAlego/NAVTool.git
cd NAVTool
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Setting-Up Without a Virtual Environment

```sh
git clone https://github.com/JMAlego/NAVTool.git
cd NAVTool
pip install -r requirements.txt
```

### Running

To run simply use:

```sh
./run.sh ./example_data
```

or

```sh
./run.bat ./example_data
```

A data path argument is required which is a path to where the data to be analysed can be found.

*NB*: Relative paths are resolved in relation to the module, not where the script was run from.

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

## TODO

- Improvements to UI,
- More modularity and shared elements in protocols,
- Additional rules for analysis,
- Additional visualisations.

## License

This project is licensed under the BSD 3-Clause license, see [LICENSE](LICENSE) for details.
