"""Field screen embedding; a full frontend URL includes its persistent API."""
from pathlib import Path
import streamlit.components.v1 as components

_field_motion = components.declare_component(
    "trackvision_field_motion",
    path=str(Path(__file__).with_name("field_frontend")),
)


def field_motion(frontend_url=None):
    if frontend_url:
        components.iframe(frontend_url, height=760, scrolling=False)
        return
    _field_motion(key="home_field_motion", default=None)
