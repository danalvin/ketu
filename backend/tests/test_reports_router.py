from fastapi.routing import APIRoute

from app.api.v1.reports import router


def _route_paths():
    return [route.path for route in router.routes if isinstance(route, APIRoute)]


def test_public_and_politician_routes_are_registered_before_dynamic_report_id_route():
    paths = _route_paths()

    assert "/public" in paths
    assert "/public/{report_id}" in paths
    assert "/politician/{politician_id}" in paths
    assert "/{report_id}" in paths

    dynamic_route_index = paths.index("/{report_id}")
    assert paths.index("/public/{report_id}") < dynamic_route_index
    assert paths.index("/politician/{politician_id}") < dynamic_route_index
