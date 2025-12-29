#!/bin/bash

GRAFANA_URL="http://localhost:3001"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

echo "🚀 重新创建Bar Chart Dashboard..."

# 创建Bar Chart dashboard
curl -X POST \
    "$GRAFANA_URL/api/dashboards/db" \
    -H "Content-Type: application/json" \
    -u "$GRAFANA_USER:$GRAFANA_PASS" \
    -d '{
        "dashboard": {
            "id": null,
            "uid": "dynamic-dashboard-barchart",
            "title": "Dynamic Dashboard - barchart",
            "tags": ["influxdb", "dynamic", "barchart"],
            "timezone": "browser",
            "panels": [{
                "id": 1,
                "title": "Bar Chart Panel",
                "type": "barchart",
                "targets": [{
                    "query": "from(bucket: \"devbucket\")\n  |> range(start: -30d)\n  |> filter(fn: (r) => r._measurement == \"${measurement}\")\n  |> filter(fn: (r) => r._field == \"${field}\")\n  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)\n  |> yield(name: \"mean\")",
                    "refId": "A"
                }],
                "fieldConfig": {
                    "defaults": {
                        "color": {"mode": "palette-classic"},
                        "custom": {
                            "hideFrom": {"legend": false, "tooltip": false, "vis": false},
                            "orient": "horizontal"
                        },
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
                "options": {
                    "orientation": "horizontal",
                    "barWidth": 0.97,
                    "groupWidth": 0.7,
                    "showValue": "auto",
                    "stacking": "none",
                    "legend": {
                        "displayMode": "visible",
                        "placement": "bottom",
                        "calcs": []
                    },
                    "tooltip": {"mode": "single", "sort": "none"}
                }
            }],
            "time": {
                "from": "now-30d",
                "to": "now"
            },
            "timepicker": {},
            "templating": {
                "list": [
                    {
                        "current": {
                            "selected": false,
                            "text": "airSensors",
                            "value": "airSensors"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Measurement",
                        "multi": false,
                        "name": "measurement",
                        "options": [],
                        "query": "import \"influxdata/influxdb/schema\"\nschema.measurements(bucket: \"devbucket\")",
                        "refresh": 1,
                        "regex": "",
                        "skipUrlSync": false,
                        "sort": 0,
                        "type": "query",
                        "datasource": {
                            "type": "influxdb",
                            "uid": "ef978f61-7d86-44ee-8d0a-e87762160cc7"
                        }
                    },
                    {
                        "current": {
                            "selected": false,
                            "text": "humidity",
                            "value": "humidity"
                        },
                        "hide": 0,
                        "includeAll": false,
                        "label": "Field",
                        "multi": false,
                        "name": "field",
                        "options": [],
                        "query": "import \"influxdata/influxdb/schema\"\nschema.measurementFieldKeys(\n  bucket: \"devbucket\",\n  measurement: \"${measurement}\"\n)",
                        "refresh": 1,
                        "regex": "",
                        "skipUrlSync": false,
                        "sort": 0,
                        "type": "query",
                        "datasource": {
                            "type": "influxdb",
                            "uid": "ef978f61-7d86-44ee-8d0a-e87762160cc7"
                        }
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

echo -e "\n✅ Bar Chart Dashboard创建完成！"
echo "🌐 访问: $GRAFANA_URL/d/dynamic-dashboard-barchart/dynamic-dashboard-barchart"