#!/bin/bash

GRAFANA_URL="http://localhost:3001"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

echo "🚀 Creating Universal Dynamic Dashboard..."

# Create a universal dashboard that accepts any query and visualization type via URL parameters
curl -X POST \
    "$GRAFANA_URL/api/dashboards/db" \
    -H "Content-Type: application/json" \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -d '{
        "dashboard": {
            "id": null,
            "uid": "universal-dashboard",
            "title": "Universal Dynamic Dashboard",
            "tags": ["universal", "dynamic", "influxdb"],
            "timezone": "browser",
            "panels": [{
                "id": 1,
                "title": "$panel_title",
                "type": "$viz_type",
                "targets": [{
                    "datasource": {
                        "type": "influxdb",
                        "uid": "ef978f61-7d86-44ee-8d0a-e87762160cc7"
                    },
                    "query": "$flux_query",
                    "refId": "A"
                }],
                "fieldConfig": {
                    "defaults": {
                        "color": {"mode": "palette-classic"},
                        "custom": {},
                        "mappings": [],
                        "thresholds": {
                            "mode": "absolute",
                            "steps": [
                                {"color": "green", "value": null},
                                {"color": "red", "value": 80}
                            ]
                        }
                    },
                    "overrides": []
                },
                "gridPos": {"h": 12, "w": 24, "x": 0, "y": 0},
                "options": {},
                "datasource": {
                    "type": "influxdb",
                    "uid": "ef978f61-7d86-44ee-8d0a-e87762160cc7"
                }
            }],
            "time": {
                "from": "$time_from",
                "to": "$time_to"
            },
            "timepicker": {},
            "templating": {
                "list": [
                    {
                        "current": {
                            "selected": false,
                            "text": "timeseries",
                            "value": "timeseries"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Visualization Type",
                        "multi": false,
                        "name": "viz_type",
                        "options": [
                            {"text": "Time series", "value": "timeseries"},
                            {"text": "Stat", "value": "stat"},
                            {"text": "Gauge", "value": "gauge"},
                            {"text": "Table", "value": "table"},
                            {"text": "Bar chart", "value": "barchart"},
                            {"text": "Pie chart", "value": "piechart"},
                            {"text": "Heatmap", "value": "heatmap"},
                            {"text": "Histogram", "value": "histogram"}
                        ],
                        "query": "",
                        "queryValue": "",
                        "skipUrlSync": false,
                        "type": "custom"
                    },
                    {
                        "current": {
                            "selected": false,
                            "text": "Dynamic Panel",
                            "value": "Dynamic Panel"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Panel Title",
                        "multi": false,
                        "name": "panel_title",
                        "options": [],
                        "query": "",
                        "skipUrlSync": false,
                        "type": "textbox"
                    },
                    {
                        "current": {
                            "selected": false,
                            "text": "",
                            "value": ""
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Flux Query",
                        "multi": false,
                        "name": "flux_query",
                        "options": [],
                        "query": "",
                        "skipUrlSync": false,
                        "type": "textbox"
                    },
                    {
                        "current": {
                            "selected": false,
                            "text": "now-24h",
                            "value": "now-24h"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Time From",
                        "multi": false,
                        "name": "time_from",
                        "options": [],
                        "query": "",
                        "skipUrlSync": false,
                        "type": "textbox"
                    },
                    {
                        "current": {
                            "selected": false,
                            "text": "now",
                            "value": "now"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Time To",
                        "multi": false,
                        "name": "time_to",
                        "options": [],
                        "query": "",
                        "skipUrlSync": false,
                        "type": "textbox"
                    }
                ]
            },
            "annotations": {
                "list": []
            },
            "refresh": "5s",
            "schemaVersion": 37,
            "version": 0,
            "links": []
        },
        "overwrite": true
    }'

echo -e "\n✅ Universal Dashboard created successfully!"
echo "🌐 Visit: $GRAFANA_URL/d/universal-dashboard/universal-dynamic-dashboard"
echo "🔗 Solo panel URL: $GRAFANA_URL/d-solo/universal-dashboard/universal-dynamic-dashboard?orgId=1&panelId=1"
echo ""
echo "Usage:"
echo "- var-viz_type: Set visualization type (timeseries, stat, gauge, table, barchart, piechart, heatmap, histogram)"
echo "- var-panel_title: Set panel title"
echo "- var-flux_query: Set Flux query"
echo "- var-time_from: Set start time (default: now-24h)"
echo "- var-time_to: Set end time (default: now)"