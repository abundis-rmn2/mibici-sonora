from typing import Dict, List, Any

# In-memory state: station_id -> {bikes, docks, etc.}
previous_state: Dict[str, Dict[str, Any]] = {}

def compute_diff(current_stations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Compares current stations payload against the previous state.
    Returns a list of stations that have changed.
    """
    global previous_state
    diffs = []
    
    new_state = {}
    for st in current_stations:
        sid = st.get('station_id')
        if not sid:
            continue
            
        bikes = st.get('num_bikes_available', 0)
        docks = st.get('num_docks_available', 0)
        
        current_data = {
            'bikes': bikes,
            'docks': docks,
            'disabled': st.get('num_bikes_disabled', 0),
            'is_renting': st.get('is_renting', 1) == 1,
            'is_returning': st.get('is_returning', 1) == 1,
            'last_reported': st.get('last_reported', 0)
        }
        
        new_state[sid] = current_data
        
        if sid not in previous_state:
            # First time seeing this station, consider it a diff
            diffs.append({'station_id': sid, **current_data})
        else:
            prev = previous_state[sid]
            # Check if relevant data changed
            if prev['bikes'] != bikes or prev['docks'] != docks:
                diffs.append({'station_id': sid, **current_data})
                
    previous_state = new_state
    return diffs
