from dataclasses import dataclass

@dataclass
class StationSummary:
    station_id: str
    name: str
    capacity: int
    lat: float
    lon: float
    region: str

@dataclass
class StationStatus:
    station_id: str
    bikes: int
    docks: int

@dataclass
class FlowEntry:
    origin_id: str
    destination_id: str
    bike_count: int

@dataclass
class StationBalance:
    station_id: str
    name: str
    balance: int
    availability_free: float
    availability_bikes: float

@dataclass
class StationMovement:
    station_id: str
    name: str
    movement: int
