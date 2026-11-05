"""Isolated, display-only field motion for Home; no job or navigation actions."""
from pathlib import Path
import streamlit.components.v1 as components

_field_motion = components.declare_component(
    "trackvision_field_motion",
    path=str(Path(__file__).with_name("field_frontend")),
)


def field_motion():
    _field_motion(key="home_field_motion", default=None)
