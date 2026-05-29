from datetime import datetime
from typing import Dict, List, Optional

from domain.dtos import FlowEntry, StationBalance, StationMovement, StationStatus, StationSummary
from domain.ports import EventRepository, SnapshotRepository, StationRepository


class AnalyticsService:
    def __init__(
        self,
        station_repo: StationRepository,
        snapshot_repo: SnapshotRepository,
        event_repo: EventRepository,
    ):
        self.station_repo = station_repo
        self.snapshot_repo = snapshot_repo
        self.event_repo = event_repo

    async def get_station_summaries(self) -> List[StationSummary]:
        stations = await self.station_repo.get_all()
        return [
            StationSummary(
                station_id=s.id,
                name=s.name,
                capacity=s.capacity,
                lat=s.lat,
                lon=s.lon,
                region=s.region,
            )
            for s in stations
        ]

    async def get_current_status(self) -> Dict[str, StationStatus]:
        latest = await self.snapshot_repo.get_latest_by_station()
        return {
            sid: StationStatus(
                station_id=snap.station_id,
                bikes=snap.bikes,
                docks=snap.docks,
            )
            for sid, snap in latest.items()
        }

    async def get_station_history(self, station_id: str, limit: int = 100, start: Optional[datetime] = None, end: Optional[datetime] = None):
        # We fetch the standard history for now.
        return await self.snapshot_repo.get_history(station_id, limit=limit)

    async def get_recent_events(self, limit: int = 50, station_id: Optional[str] = None):
        if station_id:
            return await self.event_repo.get_by_station(station_id, limit=limit)
        return await self.event_repo.get_latest(limit=limit)

    async def get_city_flow(self, limit: int = 20, start: Optional[datetime] = None, end: Optional[datetime] = None) -> List[FlowEntry]:
        # Approximate flow by matching top 'taken' stations with top 'returned' stations
        summary = await self.event_repo.get_events_summary(start, end)
        origins = []
        destinations = []
        
        for sid, counts in summary.items():
            if counts["taken"] > 0:
                origins.append((sid, counts["taken"]))
            if counts["returned"] > 0:
                destinations.append((sid, counts["returned"]))
                
        # Sort to find top origins and destinations
        origins.sort(key=lambda x: x[1], reverse=True)
        destinations.sort(key=lambda x: x[1], reverse=True)
        
        flows = []
        for orig, dest in zip(origins[:limit], destinations[:limit]):
            # create synthetic flow proportional to the minimum of taken/returned
            flows.append(FlowEntry(
                origin_id=orig[0],
                destination_id=dest[0],
                bike_count=min(orig[1], dest[1])
            ))
        return flows

    async def calculate_balance_and_availability(self, start: Optional[datetime] = None, end: Optional[datetime] = None, top_n: int = 25):
        summary = await self.event_repo.get_events_summary(start, end)
        stations = await self.station_repo.get_all()
        latest = await self.snapshot_repo.get_latest_by_station()
        
        station_map = {s.id: s for s in stations}
        balances = []
        
        for sid, counts in summary.items():
            station = station_map.get(sid)
            if not station or station.capacity == 0:
                continue
                
            balance = counts["returned"] - counts["taken"]
            snap = latest.get(sid)
            
            if snap:
                av_free = snap.docks / station.capacity
                av_bikes = snap.bikes / station.capacity
            else:
                av_free = 0.0
                av_bikes = 0.0
                
            balances.append(StationBalance(
                station_id=sid,
                name=station.name,
                balance=balance,
                availability_free=av_free,
                availability_bikes=av_bikes
            ))
            
        balances.sort(key=lambda x: x.balance, reverse=True)
        
        return {
            "best": balances[:top_n],
            "worst": balances[-top_n:][::-1] if len(balances) >= top_n else balances[::-1]
        }

    async def classify_movement(self, threshold: int = 8, start: Optional[datetime] = None, end: Optional[datetime] = None):
        mass_events = await self.event_repo.get_mass_movements(threshold, start, end)
        stations = await self.station_repo.get_all()
        station_map = {s.id: s.name for s in stations}
        
        more = []
        less = []
        
        for e in mass_events:
            name = station_map.get(e.station_id, f"Station {e.station_id}")
            mov = StationMovement(
                station_id=e.station_id,
                name=name,
                movement=e.delta if e.event_type == "bike_returned" else -e.delta
            )
            if e.event_type == "bike_returned":
                more.append(mov)
            else:
                less.append(mov)
                
        return {
            "more": more,
            "less": less
        }
