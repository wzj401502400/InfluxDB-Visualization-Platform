#!/bin/bash

GRAFANA_URL="http://localhost:3001"
GRAFANA_USER="admin"
GRAFANA_PASS="admin"

echo "🚀 创建所有可视化类型的Grafana Dashboard..."

# 创建各种可视化类型的dashboard
visualization_types=("piechart" "heatmap" "histogram")

for viz_type in "${visualization_types[@]}"; do
    echo "创建 ${viz_type} dashboard..."

    case "$viz_type" in
        "piechart")
            panel_config='{
                "id": 1,
                "title": "Pie Chart Panel",
                "type": "piechart",
                "targets": [{
                    "query": "from(bucket: \"devbucket\")\n  |> range(start: -30d)\n  |> filter(fn: (r) => r._measurement == \"${measurement}\")\n  |> filter(fn: (r) => r._field == \"${field}\")\n  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)\n  |> yield(name: \"mean\")",
                    "refId": "A"
                }],
                "fieldConfig": {
                    "defaults": {
                        "color": {"mode": "palette-classic"},
                        "custom": {
                            "hideFrom": {"legend": false, "tooltip": false, "vis": false}
                        },
                        "mappings": []
                    },
                    "overrides": []
                },
                "gridPos": {"h": 12, "w": 24, "x": 0, "y": 0},
                "options": {
                    "reduceOptions": {
                        "values": false,
                        "calcs": ["lastNotNull"],
                        "fields": ""
                    },
                    "pieType": "pie",
                    "tooltip": {"mode": "single", "sort": "none"},
                    "legend": {
                        "displayMode": "visible",
                        "placement": "bottom",
                        "calcs": []
                    }
                }
            }'
            ;;
        "heatmap")
            panel_config='{
                "id": 1,
                "title": "Heatmap Panel",
                "type": "heatmap",
                "targets": [{
                    "query": "from(bucket: \"devbucket\")\n  |> range(start: -30d)\n  |> filter(fn: (r) => r._measurement == \"${measurement}\")\n  |> filter(fn: (r) => r._field == \"${field}\")\n  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)\n  |> yield(name: \"mean\")",
                    "refId": "A"
                }],
                "fieldConfig": {
                    "defaults": {
                        "color": {"mode": "spectrum"},
                        "custom": {
                            "hideFrom": {"legend": false, "tooltip": false, "vis": false}
                        }
                    },
                    "overrides": []
                },
                "gridPos": {"h": 12, "w": 24, "x": 0, "y": 0},
                "options": {
                    "calculate": false,
                    "cellGap": 1,
                    "cellValues": {},
                    "color": {
                        "exponent": 0.5,
                        "fill": "dark-orange",
                        "mode": "spectrum",
                        "reverse": false,
                        "scale": "exponential",
                        "scheme": "Spectral",
                        "steps": 64
                    },
                    "showValue": "never",
                    "tooltip": {"show": true, "yHistogram": false}
                }
            }'
            ;;
        "histogram")
            panel_config='{
                "id": 1,
                "title": "Histogram Panel",
                "type": "histogram",
                "targets": [{
                    "query": "from(bucket: \"devbucket\")\n  |> range(start: -30d)\n  |> filter(fn: (r) => r._measurement == \"${measurement}\")\n  |> filter(fn: (r) => r._field == \"${field}\")\n  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)\n  |> yield(name: \"mean\")",
                    "refId": "A"
                }],
                "fieldConfig": {
                    "defaults": {
                        "color": {"mode": "palette-classic"},
                        "custom": {
                            "hideFrom": {"legend": false, "tooltip": false, "vis": false}
                        }
                    },
                    "overrides": []
                },
                "gridPos": {"h": 12, "w": 24, "x": 0, "y": 0},
                "options": {
                    "bucketSize": 10,
                    "tooltip": {"mode": "single", "sort": "none"}
                }
            }'
            ;;
    esac

    # 创建dashboard
    curl -X POST \
        "$GRAFANA_URL/api/dashboards/db" \
        -H "Content-Type: application/json" \
        -u "$GRAFANA_USER:$GRAFANA_PASS" \
        -d "{
            \"dashboard\": {
                \"id\": null,
                \"uid\": \"dynamic-dashboard-${viz_type}\",
                \"title\": \"Dynamic Dashboard - ${viz_type}\",
                \"tags\": [\"influxdb\", \"dynamic\", \"${viz_type}\"],
                \"timezone\": \"browser\",
                \"panels\": [${panel_config}],
                \"time\": {
                    \"from\": \"now-30d\",
                    \"to\": \"now\"
                },
                \"timepicker\": {},
                \"templating\": {
                    \"list\": [
                        {
                            \"current\": {
                                \"selected\": false,
                                \"text\": \"airSensors\",
                                \"value\": \"airSensors\"
                            },
                            \"hide\": 0,
                            \"includeAll\": false,
                            \"label\": \"Measurement\",
                            \"multi\": false,
                            \"name\": \"measurement\",
                            \"options\": [],
                            \"query\": \"import \\\"influxdata/influxdb/schema\\\"\\nschema.measurements(bucket: \\\"devbucket\\\")\",
                            \"refresh\": 1,
                            \"regex\": \"\",
                            \"skipUrlSync\": false,
                            \"sort\": 0,
                            \"type\": \"query\",
                            \"datasource\": {
                                \"type\": \"influxdb\",
                                \"uid\": \"ef978f61-7d86-44ee-8d0a-e87762160cc7\"
                            }
                        },
                        {
                            \"current\": {
                                \"selected\": false,
                                \"text\": \"humidity\",
                                \"value\": \"humidity\"
                            },
                            \"hide\": 0,
                            \"includeAll\": false,
                            \"label\": \"Field\",
                            \"multi\": false,
                            \"name\": \"field\",
                            \"options\": [],
                            \"query\": \"import \\\"influxdata/influxdb/schema\\\"\\nschema.measurementFieldKeys(\\n  bucket: \\\"devbucket\\\",\\n  measurement: \\\"\${measurement}\\\"\\n)\",
                            \"refresh\": 1,
                            \"regex\": \"\",
                            \"skipUrlSync\": false,
                            \"sort\": 0,
                            \"type\": \"query\",
                            \"datasource\": {
                                \"type\": \"influxdb\",
                                \"uid\": \"ef978f61-7d86-44ee-8d0a-e87762160cc7\"
                            }
                        }
                    ]
                },
                \"annotations\": {
                    \"list\": []
                },
                \"refresh\": \"5s\",
                \"schemaVersion\": 37,
                \"version\": 0,
                \"links\": []
            },
            \"overwrite\": true
        }"

    echo "✅ ${viz_type} dashboard 创建完成"
done

echo -e "\n🎉 所有可视化类型的Dashboard创建完成！"
echo "现在支持的可视化类型："
echo "- Time Series: http://localhost:3001/d/dynamic-dashboard-timeseries"
echo "- Stat: http://localhost:3001/d/dynamic-dashboard-stat"
echo "- Gauge: http://localhost:3001/d/dynamic-dashboard-gauge"
echo "- Table: http://localhost:3001/d/dynamic-dashboard-table"
echo "- Bar Chart: http://localhost:3001/d/dynamic-dashboard-barchart"
echo "- Pie Chart: http://localhost:3001/d/dynamic-dashboard-piechart"
echo "- Heatmap: http://localhost:3001/d/dynamic-dashboard-heatmap"
echo "- Histogram: http://localhost:3001/d/dynamic-dashboard-histogram"