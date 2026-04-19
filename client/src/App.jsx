import { useEffect, useMemo, useState, useRef } from 'react';

import {
  login as loginApi,
  logout as logoutApi,
  fetchBuckets,
  fetchMeasurements,
  fetchFields,
  fetchTagKeys,
  fetchTagValues,
  runQuerySpec,
} from './services/api';
import { buildQuerySpecFromUI, sanitizeFlux } from './utils/flux';
import { getAggregateWindow } from './config/grafana';

/* ============ Top Bar ============ */
function Topbar({ loggedIn, onLoginOpen, onLogout }) {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
      {/* Thin accent bar: brand color highlight */}
      <div className="h-0.5 bg-sky-600" />
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-sky-700">No-Code Solution for InfluxDB</span>
        </div>

        <div className="flex items-center gap-2">
          {!loggedIn ? (
            <button
              onClick={onLoginOpen}
              className="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 ring-1 ring-inset ring-black/5 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              Login
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ============ Tree Node Component ============ */
function TreeNode({ node, level = 0, onDragStart, expandedNodes, onToggle }) {
  const getNodeIcon = (type) => {
    switch (type) {
      case 'bucket':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4-8-4m16 0v10l-8 4-8-4V7" />
          </svg>
        );
      case 'measurement':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'field':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      case 'tag':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const getTagColor = (type) => {
    switch (type) {
      case 'bucket':
        return 'bg-blue-100 text-blue-700';
      case 'measurement':
        return 'bg-green-100 text-green-700';
      case 'field':
        return 'bg-orange-100 text-orange-700';
      case 'tag':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const hasChildren = node.children && node.children.length > 0;
  const canExpand = hasChildren;
  const isExpanded = expandedNodes && expandedNodes.has(node.id);

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 py-1 px-2 rounded-lg transition-all cursor-grab hover:cursor-grabbing hover:bg-blue-50 border border-gray-200 hover:border-blue-300 hover:shadow-sm"
        style={{ marginLeft: `${level * 16}px` }}
        draggable
        onDragStart={(e) => onDragStart(e, node)}
      >
        {canExpand && (
          <button
            onClick={() => onToggle(node.id)}
            className="p-0.5 rounded hover:bg-gray-100"
          >
            <svg
              className={`w-3 h-3 transition-transform text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!canExpand && <div className="w-4" />}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`p-1 rounded ${
            node.type === 'bucket' ? 'text-blue-600' :
            node.type === 'measurement' ? 'text-green-600' :
            node.type === 'field' ? 'text-orange-600' :
            node.type === 'tag' ? 'text-purple-600' :
            'text-gray-600'
          }`}>
            {getNodeIcon(node.type)}
          </div>
          <span className="text-sm font-medium truncate text-gray-900">{node.name}</span>
          {node.count && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border">
              {node.count}
            </span>
          )}
        </div>

        <div className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getTagColor(node.type)}`}>
          {node.type}
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onDragStart={onDragStart}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}


/* ============ Tag Value Selector Component ============ */
function TagValueSelector({ tagName, tagKey, buckets, onValueChange, selectedValue }) {
  const [availableValues, setAvailableValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load available tag values
  useEffect(() => {
    const loadTagValues = async () => {
      if (!buckets || buckets.length === 0) return;

      setLoading(true);
      try {
        // Try to get tag values from the first bucket
        const bucketId = buckets[0].id;
        const values = await fetchTagValues(bucketId, tagKey, {
          start: '-30d'
        });
        setAvailableValues(values || []);
      } catch (error) {
        console.error('Failed to fetch tag values:', error);
        setAvailableValues([]);
      } finally {
        setLoading(false);
      }
    };

    loadTagValues();
  }, [tagKey, buckets]);

  if (loading) {
    return (
      <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50/80 backdrop-blur-sm flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        Loading {tagName} values...
      </div>
    );
  }

  if (availableValues.length === 0) {
    return (
      <input
        type="text"
        value={selectedValue}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={`Enter ${tagName} value (e.g., BuildingA)...`}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
      />
    );
  }

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md text-left flex items-center justify-between"
        >
          <span className={selectedValue ? "text-gray-900" : "text-gray-500"}>
            {selectedValue || `Select ${tagName}...`}
          </span>
          <svg
            className={`w-4 h-4 text-purple-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {availableValues.map((value, index) => (
              <div
                key={index}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-200 ${
                  index > 0 ? 'border-t border-gray-100' : ''
                } ${
                  selectedValue === value
                    ? 'bg-purple-500 text-white font-medium'
                    : 'text-gray-900 hover:bg-purple-50 hover:text-purple-700'
                }`}
                onClick={() => {
                  onValueChange(value);
                  setIsOpen(false);
                }}
              >
                {value}
              </div>
            ))}
          </div>
        )}
      </div>
      {availableValues.length > 0 && (
        <p className="text-xs text-purple-600 font-medium">
          {availableValues.length} options available
        </p>
      )}
    </div>
  );
}

/* ============ Saved Hierarchy Query Form ============ */
function SavedHierarchyQueryForm({ savedHierarchy, buckets, hierarchyQuerySelection, setHierarchyQuerySelection, range, showFluxInWorkbench, setShowFluxInWorkbench, setHierarchyFluxText, hierarchyVisualizationType }) {
  console.log('SavedHierarchyQueryForm render - savedHierarchy:', savedHierarchy);
  console.log('SavedHierarchyQueryForm render - buckets:', buckets);

  const [selectedFields, setSelectedFields] = useState([]);
  const [tagFilters, setTagFilters] = useState({});
  const [localFluxText, setLocalFluxText] = useState('');
  const [localRange, setLocalRange] = useState(range || '-1h');
  const [copied, setCopied] = useState(false);
  const [aggregateFunction, setAggregateFunction] = useState('mean');

  // Extract info from savedHierarchy
  const extractHierarchyInfo = () => {
    if (!savedHierarchy || savedHierarchy.length === 0) return null;

    console.log('Analyzing savedHierarchy:', savedHierarchy);

    // Analyze hierarchy structure, extract all info
    let bucketInfo = null;
    const measurementInfos = new Map(); // Use Map to store multiple measurements
    const fieldNodes = [];
    const tagNodes = [];

    function analyzeNode(node, parentMeasurement = null) {
      let currentMeasurement = parentMeasurement;

      switch (node.type) {
        case 'bucket':
          bucketInfo = {
            id: node.data?.bucketId || node.data?.id,
            name: node.name
          };
          break;
        case 'measurement':
          currentMeasurement = node.data?.measurement || node.name;
          measurementInfos.set(currentMeasurement, {
            name: currentMeasurement
          });
          break;
        case 'field':
          fieldNodes.push({
            name: node.data?.field || node.name,
            originalName: node.name,
            measurement: currentMeasurement // Record which measurement this field belongs to
          });
          break;
        case 'tag':
          tagNodes.push({
            name: node.name,
            tagKey: node.data?.tagKey || node.data?.tag || node.name
          });
          break;
      }

      if (node.children) {
        node.children.forEach(child => analyzeNode(child, currentMeasurement));
      }
    }

    // Analyze all nodes
    savedHierarchy.forEach(node => analyzeNode(node));

    // Infer measurements from fields (if no explicit measurement nodes)
    if (measurementInfos.size === 0 && fieldNodes.length > 0) {
      fieldNodes.forEach(field => {
        if (field.measurement && !measurementInfos.has(field.measurement)) {
          measurementInfos.set(field.measurement, {
            name: field.measurement
          });
        }
      });
    }

    // Assign default measurements to fields without measurement info
    fieldNodes.forEach(field => {
      if (!field.measurement) {
        // Guess which measurement a field belongs to based on field name
        if (['actual_temp', 'fan_speed', 'power_consumption', 'setpoint_temp'].includes(field.name)) {
          field.measurement = 'hvac_systems';
          if (!measurementInfos.has('hvac_systems')) {
            measurementInfos.set('hvac_systems', { name: 'hvac_systems' });
          }
        } else {
          field.measurement = 'environment_sensors';
          if (!measurementInfos.has('environment_sensors')) {
            measurementInfos.set('environment_sensors', { name: 'environment_sensors' });
          }
        }
      }
    });

    // If no bucket found, try to get from other sources
    if (!bucketInfo && buckets && buckets.length > 0) {
      bucketInfo = {
        id: buckets[0].id,
        name: buckets[0].name
      };
    }

    // Convert measurementInfos to array
    const measurements = Array.from(measurementInfos.values());

    console.log('Final extracted info:', {
      bucket: bucketInfo,
      measurements: measurements,
      fields: fieldNodes,
      tags: tagNodes
    });

    return {
      bucket: bucketInfo,
      measurements: measurements,
      measurement: measurements[0], // Maintain backward compatibility
      fields: fieldNodes,
      tags: tagNodes,
      isValid: fieldNodes.length > 0
    };
  };

  const hierarchyInfo = extractHierarchyInfo();

  // Add state for bucket/measurement selection (used only when auto-detection fails)
  const [manualBucket, setManualBucket] = useState('');
  const [manualMeasurement, setManualMeasurement] = useState('');

  // Generate Flux query
  const generateFluxQuery = () => {
    console.log('generateFluxQuery called');
    console.log('hierarchyInfo:', hierarchyInfo);
    console.log('selectedFields:', selectedFields);
    console.log('tagFilters:', tagFilters);

    if (!hierarchyInfo || selectedFields.length === 0) {
      console.log('Early return: missing hierarchyInfo or selectedFields');
      return '';
    }

    const bucketId = hierarchyInfo.bucket?.id || manualBucket;
    const bucketName = buckets.find(b => b.id === bucketId)?.name;

    if (!bucketId || !bucketName) {
      console.log('Early return: missing bucketId or bucketName');
      return '';
    }

    // Group fields by measurement
    const fieldsByMeasurement = new Map();
    hierarchyInfo.fields.forEach(field => {
      if (selectedFields.includes(field.name)) {
        const measurement = field.measurement || 'environment_sensors';
        if (!fieldsByMeasurement.has(measurement)) {
          fieldsByMeasurement.set(measurement, []);
        }
        fieldsByMeasurement.get(measurement).push(field.name);
      }
    });

    console.log('Fields by measurement:', fieldsByMeasurement);

    // If only one measurement, use a simple query
    if (fieldsByMeasurement.size === 1) {
      const [measurement, fields] = fieldsByMeasurement.entries().next().value;

      let flux = `from(bucket: "${bucketName}")
  |> range(start: ${localRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")`;

      // Add field filter
      if (fields.length > 0) {
        flux += `
  |> filter(fn: (r) => ${fields.map(field => `r._field == "${field}"`).join(' or ')})`;
      }

      // Add tag filters
      Object.entries(tagFilters).forEach(([tagKey, tagValue]) => {
        if (tagValue && tagValue !== '') {
          flux += `
  |> filter(fn: (r) => r.${tagKey} == "${tagValue}")`;
        }
      });

      flux += `
  |> aggregateWindow(every: ${getAggregateWindow(localRange)}, fn: ${aggregateFunction}, createEmpty: false)
  |> yield(name: "${aggregateFunction}")`;

      console.log('Single measurement flux:', flux);
      return flux;
    }

    // Cross-measurement query: use union
    const queries = [];
    fieldsByMeasurement.forEach((fields, measurement) => {
      let subQuery = `from(bucket: "${bucketName}")
  |> range(start: ${localRange})
  |> filter(fn: (r) => r._measurement == "${measurement}")`;

      // Add field filter
      if (fields.length > 0) {
        subQuery += `
  |> filter(fn: (r) => ${fields.map(field => `r._field == "${field}"`).join(' or ')})`;
      }

      // Add tag filters
      Object.entries(tagFilters).forEach(([tagKey, tagValue]) => {
        if (tagValue && tagValue !== '') {
          subQuery += `
  |> filter(fn: (r) => r.${tagKey} == "${tagValue}")`;
        }
      });

      subQuery += `
  |> aggregateWindow(every: ${getAggregateWindow(localRange)}, fn: ${aggregateFunction}, createEmpty: false)`;

      queries.push(subQuery);
    });

    // Use union to merge queries
    const flux = `union(tables: [
${queries.map(query => `  (${query})`).join(',\n')}
])
  |> sort(columns: ["_time"])
  |> yield(name: "cross_measurement")`;

    console.log('Cross-measurement flux:', flux);
    return flux;
  };

  const handleRunQuery = async () => {
    try {
      console.log('handleRunQuery clicked');
      const flux = generateFluxQuery();
      console.log('Generated flux:', flux);

      setLocalFluxText(flux);
      setHierarchyFluxText(flux);  // Also set the main app's hierarchyFluxText
      console.log('Local flux text set:', flux);

      // Also trigger Grafana visualization
      if (hierarchyInfo && selectedFields.length > 0) {
        const bucketName = buckets.find(b => b.id === hierarchyInfo.bucket?.id)?.name;

        if (bucketName) {
          console.log('Setting up Grafana visualization...');

          // Convert tagFilters to the format expected by GrafanaPanel
          const selectedTags = Object.entries(tagFilters)
            .filter(([key, value]) => value && value !== '')
            .map(([key, value]) => ({
              key,
              values: [value]
            }));

          // Check if this is a cross-measurement query
          const fieldsByMeasurement = new Map();
          hierarchyInfo.fields.forEach(field => {
            if (selectedFields.includes(field.name)) {
              const measurement = field.measurement || 'environment_sensors';
              if (!fieldsByMeasurement.has(measurement)) {
                fieldsByMeasurement.set(measurement, []);
              }
              fieldsByMeasurement.get(measurement).push(field.name);
            }
          });

          const isCrossMeasurement = fieldsByMeasurement.size > 1;
          console.log('Is cross-measurement query:', isCrossMeasurement);
          console.log('Fields by measurement:', fieldsByMeasurement);

          if (isCrossMeasurement) {
            // For cross-measurement queries, use the generated Flux directly
            setHierarchyQuerySelection({
              measurement: 'cross_measurement', // Special identifier
              selectedField: selectedFields[0],
              selectedFields: selectedFields,
              selectedTags: selectedTags,
              range: localRange,
              bucketName: bucketName,
              visualizationType: hierarchyVisualizationType || 'timeseries',
              isCrossMeasurement: true,
              flux: flux, // Pass the generated Flux query
              measurements: Array.from(fieldsByMeasurement.keys())
            });
          } else {
            // Single measurement query
            const measurementName = fieldsByMeasurement.keys().next().value;
            setHierarchyQuerySelection({
              measurement: measurementName,
              selectedField: selectedFields[0],
              selectedFields: selectedFields,
              selectedTags: selectedTags,
              range: localRange,
              bucketName: bucketName,
              visualizationType: hierarchyVisualizationType || 'timeseries'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in handleRunQuery:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (!hierarchyInfo) {
    return (
      <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Saved Hierarchy</h3>
          <p className="text-sm text-gray-500 mb-4">You haven't saved any hierarchy definitions yet.</p>
          <p className="text-xs text-gray-400">Create a hierarchy using the Custom Hierarchy Query section above, then save it to use here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">

      {/* Step 1: Display by hierarchy - first layer is Tags */}
      {hierarchyInfo.tags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            Select Tag Values
          </label>
          {hierarchyInfo.tags.map((tag, index) => (
            <div key={index} className="mb-3 border border-gray-200 rounded-lg p-3">
              <label className="block text-sm font-bold text-purple-700 mb-2">
                {tag.name}
              </label>
              <TagValueSelector
                tagName={tag.name}
                tagKey={tag.tagKey}
                buckets={buckets}
                onValueChange={(value) => {
                  setTagFilters({
                    ...tagFilters,
                    [tag.tagKey]: value
                  });
                }}
                selectedValue={tagFilters[tag.tagKey] || ''}
              />
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Auto-display detected info */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          Detected Configuration
        </label>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-bold text-blue-600">Bucket:</span>
            <span className="ml-2 text-blue-600">
              {buckets.find(b => b.id === (hierarchyInfo.bucket?.id || manualBucket))?.name || 'devbucket'}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-bold text-green-600">
              {hierarchyInfo.measurements?.length > 1 ? 'Measurements:' : 'Measurement:'}
            </span>
            <span className="ml-2 text-green-600">
              {hierarchyInfo.measurements?.length > 0
                ? hierarchyInfo.measurements.map(m => m.name).join(', ')
                : 'environment_sensors'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Step 3: Time Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Range
        </label>
        <CustomDropdown
          value={localRange}
          onChange={(value) => {
            setLocalRange(value);
            console.log('Time range changed to:', value);
          }}
          options={[
            { value: "-5m", label: "Last 5 minutes" },
            { value: "-15m", label: "Last 15 minutes" },
            { value: "-30m", label: "Last 30 minutes" },
            { value: "-1h", label: "Last 1 hour" },
            { value: "-3h", label: "Last 3 hours" },
            { value: "-6h", label: "Last 6 hours" },
            { value: "-12h", label: "Last 12 hours" },
            { value: "-24h", label: "Last 24 hours" },
            { value: "-2d", label: "Last 2 days" },
            { value: "-7d", label: "Last 7 days" },
            { value: "-30d", label: "Last 30 days" },
            { value: "-90d", label: "Last 90 days" }
          ]}
          placeholder="Select time range"
        />
      </div>

      {/* Step 3.5: Aggregation Function */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aggregation Function
        </label>
        <CustomDropdown
          value={aggregateFunction}
          onChange={(value) => {
            setAggregateFunction(value);
            console.log('Aggregation function changed to:', value);
          }}
          options={[
            { value: "mean", label: "Mean (Average)" },
            { value: "sum", label: "Sum" },
            { value: "max", label: "Maximum" },
            { value: "min", label: "Minimum" },
            { value: "median", label: "Median" },
            { value: "last", label: "Last Value" },
            { value: "first", label: "First Value" },
            { value: "count", label: "Count" },
            { value: "stddev", label: "Standard Deviation" }
          ]}
          placeholder="Select aggregation function"
        />
      </div>

      {/* Step 4: Field selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          Select Fields to Query
        </label>
        <div className="grid grid-cols-2 gap-2">
          {hierarchyInfo.fields.map((field, index) => (
            <label key={index} className="flex items-center text-sm p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                className="mr-2 rounded border-gray-300"
                checked={selectedFields.includes(field.name)}
                onChange={(e) => {
                  const fieldName = field.name;
                  if (e.target.checked) {
                    setSelectedFields([...selectedFields, fieldName]);
                  } else {
                    setSelectedFields(selectedFields.filter(f => f !== fieldName));
                  }
                }}
              />
              <span className="font-medium">{field.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Step 4: Buttons */}
      <div className="pt-2 border-t">
        <div className="flex gap-2">
          <button
            onClick={handleRunQuery}
            disabled={selectedFields.length === 0}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit
          </button>
          <button
            onClick={() => setShowFluxInWorkbench(!showFluxInWorkbench)}
            className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
              showFluxInWorkbench
                ? 'bg-green-100 bg-opacity-60 text-green-800 border border-green-300 hover:bg-green-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {showFluxInWorkbench ? 'Hide Flux' : 'Show Flux'}
          </button>
          <button
            onClick={() => {
              setSelectedFields([]);
              setTagFilters({});
              setLocalFluxText('');
              setHierarchyQuerySelection({});
              setHierarchyFluxText('');
            }}
            className="inline-flex items-center justify-center rounded-xl bg-gray-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700"
          >
            Reset
          </button>
        </div>

        {selectedFields.length === 0 && (
          <p className="text-xs text-gray-500 mt-1 text-center">Please select at least one field</p>
        )}
      </div>


    </div>
  );
}

// Helper: find a node of the specified type
function findNodeByType(node, type) {
  if (node.type === type) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByType(child, type);
      if (found) return found;
    }
  }
  return null;
}

// Helper: find all nodes of the specified type
function findAllNodesByType(node, type) {
  const results = [];

  function traverse(currentNode) {
    if (currentNode.type === type) {
      results.push(currentNode);
    }
    if (currentNode.children) {
      currentNode.children.forEach(traverse);
    }
  }

  traverse(node);
  return results;
}

/* ============ Hierarchy Flux Query Generation ============ */
function generateHierarchyFlux(selectedNode, customHierarchy, range, buckets, aggregateFunction = 'mean') {
  if (!selectedNode) return '';

  // Generate different queries based on selected node type
  const bucketId = selectedNode.data?.bucketId || getNodeBucketId(selectedNode, customHierarchy);
  const bucketName = buckets.find(b => b.id === bucketId)?.name;
  if (!bucketName) return '';

  let flux = `from(bucket: "${bucketName}")
  |> range(start: ${range})`;

  // Add filter conditions based on node type
  const measurement = selectedNode.data?.measurement || getNodeMeasurement(selectedNode, customHierarchy);
  if (measurement) {
    flux += `
  |> filter(fn: (r) => r._measurement == "${measurement}")`;
  }

  if (selectedNode.type === 'field') {
    // When a field is selected, query that field's data
    flux += `
  |> filter(fn: (r) => r._field == "${selectedNode.data.field}")`;

    // Add all tag filter conditions under this field
    const tagFilters = getTagFiltersForField(selectedNode, customHierarchy);
    if (tagFilters.length > 0) {
      tagFilters.forEach(filter => {
        flux += `
  |> filter(fn: (r) => r.${filter.key} == "${filter.value}")`;
      });
    }
  } else if (selectedNode.type === 'tag') {
    // When a tag is selected, query all fields under that tag constraint
    const fieldNames = getNodeFields(selectedNode, customHierarchy);
    if (fieldNames.length > 0) {
      flux += `
  |> filter(fn: (r) => ${fieldNames.map(name => `r._field == "${name}"`).join(' or ')})`;

      // Add tag filter condition
      const tagKey = selectedNode.data?.tagKey || selectedNode.data?.tag;
      if (tagKey) {
        flux += `
  |> filter(fn: (r) => r.${tagKey} == "${selectedNode.name}")`;
      }
    }
  } else if (selectedNode.type === 'bucket' || selectedNode.type === 'measurement') {
    // When bucket or measurement is selected, query all fields in hierarchy
    const allFields = getAllFieldsInHierarchy(selectedNode, customHierarchy);
    if (allFields.length > 0) {
      const fieldNames = allFields.map(f => f.data.field);
      flux += `
  |> filter(fn: (r) => ${fieldNames.map(name => `r._field == "${name}"`).join(' or ')})`;
    }
  }

  // Add aggregation and time window
  flux += `
  |> aggregateWindow(every: ${getAggregateWindow(range)}, fn: ${aggregateFunction}, createEmpty: false)
  |> yield(name: "${aggregateFunction}")`;

  return flux;
}

// Helper: get tag filter conditions for a field
function getTagFiltersForField(fieldNode, hierarchy) {
  const filters = [];
  // Recursively search upward for tag nodes
  function findTagAncestors(nodes, targetId, currentPath = []) {
    for (const node of nodes) {
      if (node.id === targetId) {
        return currentPath.filter(n => n.type === 'tag');
      }
      if (node.children) {
        const result = findTagAncestors(node.children, targetId, [...currentPath, node]);
        if (result) return result;
      }
    }
    return null;
  }

  const tagAncestors = findTagAncestors(hierarchy, fieldNode.id);
  if (tagAncestors) {
    tagAncestors.forEach(tag => {
      filters.push({
        key: tag.data.tagKey,
        value: tag.name
      });
    });
  }

  return filters;
}

// Helper: get parent fields of a tag
function getParentFields(tagNode, hierarchy) {
  const fields = [];
  function findInHierarchy(nodes) {
    for (const node of nodes) {
      if (node.children) {
        if (node.children.some(child => child.id === tagNode.id)) {
          if (node.type === 'field') {
            fields.push(node);
          }
        }
        findInHierarchy(node.children);
      }
    }
  }
  findInHierarchy(hierarchy);
  return fields;
}

// Helper: get all fields in a hierarchy
function getAllFieldsInHierarchy(rootNode, hierarchy) {
  const fields = [];
  function collectFields(nodes) {
    for (const node of nodes) {
      if (node.type === 'field') {
        fields.push(node);
      }
      if (node.children) {
        collectFields(node.children);
      }
    }
  }

  // If this is a root node, start collecting from its children
  if (rootNode.children) {
    collectFields(rootNode.children);
  }

  return fields;
}

// Helper: get measurement from a hierarchy node
function getNodeMeasurement(node, hierarchy) {
  if (node.data?.measurement) return node.data.measurement;

  // If this is a tag node, look up the parent field's measurement
  if (node.type === 'tag') {
    const parentFields = getParentFields(node, hierarchy);
    if (parentFields.length > 0) {
      return parentFields[0].data.measurement;
    }
  }

  // If this is a field node, infer measurement from children
  if (node.type === 'field' && node.children) {
    for (const child of node.children) {
      if (child.data?.measurement) {
        return child.data.measurement;
      }
    }
  }

  return null;
}

// Helper: get field from a hierarchy node
function getNodeField(node, hierarchy) {
  if (node.type === 'field') {
    return node.data?.field || node.name;
  }

  // If this is a tag node, get the first child field
  if (node.type === 'tag') {
    // First try to find a field among direct children
    if (node.children) {
      const fieldChild = node.children.find(child => child.type === 'field');
      if (fieldChild) {
        return fieldChild.data?.field || fieldChild.name;
      }
    }

    // Then try to find a parent field (search upward)
    const parentFields = getParentFields(node, hierarchy);
    if (parentFields.length > 0) {
      return parentFields[0].data?.field || parentFields[0].name;
    }
  }

  // If bucket or measurement, find the first field
  if (node.type === 'bucket' || node.type === 'measurement') {
    const allFields = getAllFieldsInHierarchy(node, hierarchy);
    if (allFields.length > 0) {
      return allFields[0].data?.field || allFields[0].name;
    }
  }

  return null;
}

// Helper: get multiple fields from a hierarchy node (for multi-field visualization)
function getNodeFields(node, hierarchy) {
  const fields = [];

  if (node.type === 'field') {
    return [node.data?.field || node.name];
  }

  // If tag node, get all child fields
  if (node.type === 'tag') {
    if (node.children) {
      const fieldChildren = node.children.filter(child => child.type === 'field');
      return fieldChildren.map(child => child.data?.field || child.name);
    }
  }

  // If bucket or measurement, find all fields
  if (node.type === 'bucket' || node.type === 'measurement') {
    const allFields = getAllFieldsInHierarchy(node, hierarchy);
    return allFields.map(field => field.data?.field || field.name);
  }

  return fields;
}

// Helper: get bucketId from a hierarchy node
function getNodeBucketId(node, hierarchy) {
  if (node.data?.bucketId) return node.data.bucketId;

  // Recursively search upward for bucketId
  function findBucketId(nodes) {
    for (const n of nodes) {
      if (n.data?.bucketId) return n.data.bucketId;
      if (n.children) {
        const found = findBucketId(n.children);
        if (found) return found;
      }
    }
    return null;
  }

  return findBucketId(hierarchy);
}

// Helper: get tags from a hierarchy node
function getNodeTags(node, hierarchy) {
  const tags = [];

  if (node.type === 'tag') {
    // If the selected node is a tag, include it
    tags.push({
      key: node.data?.tagKey || node.name,
      values: [node.name]
    });
  }

  // Find all tag ancestors of this node
  function findTagAncestors(nodes, targetId, path = []) {
    for (const n of nodes) {
      const currentPath = [...path, n];
      if (n.id === targetId) {
        return currentPath.filter(node => node.type === 'tag');
      }
      if (n.children) {
        const result = findTagAncestors(n.children, targetId, currentPath);
        if (result) return result;
      }
    }
    return null;
  }

  const tagAncestors = findTagAncestors(hierarchy, node.id);
  if (tagAncestors) {
    tagAncestors.forEach(tag => {
      if (!tags.some(t => t.key === (tag.data?.tagKey || tag.name))) {
        tags.push({
          key: tag.data?.tagKey || tag.name,
          values: [tag.name]
        });
      }
    });
  }

  return tags;
}

/* ============ Data Relationship Validation ============ */
function validateDataRelationship(parentNode, childNode, treeData) {
  // If root level, always allow
  if (!parentNode) return true;

  const parentData = parentNode.data;
  const childData = childNode.data;

  // Validate whether a child node can be placed under a parent based on type
  switch (parentNode.type) {
    case 'bucket':
      // Only measurements belonging to this bucket are allowed
      return childNode.type === 'measurement' &&
             childData.bucketId === parentData.id;

    case 'measurement':
      // Only fields belonging to this measurement are allowed
      return childNode.type === 'field' &&
             childData.bucketId === parentData.bucketId &&
             childData.measurement === parentData.measurement;

    case 'field':
      // Only tags that actually exist under this field are allowed
      if (childNode.type !== 'tag') return false;

      // Find this field in the tree data and check if the tag exists
      const findFieldInTree = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'field' &&
              node.data.bucketId === parentData.bucketId &&
              node.data.measurement === parentData.measurement &&
              node.data.field === parentData.field) {
            return node;
          }
          if (node.children) {
            const found = findFieldInTree(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const fieldNode = findFieldInTree(treeData);
      if (!fieldNode) return false;

      // Check if the tag exists under this field
      return fieldNode.children.some(tag =>
        tag.type === 'tag' &&
        tag.data.tagKey === childData.tagKey
      );

    case 'tag':
      // A field can be placed under a tag, but must verify the field actually has this tag
      if (childNode.type !== 'field') return false;

      // Find this field in the tree data and check if it contains this tag
      const findFieldWithTag = (nodes) => {
        for (const node of nodes) {
          if (node.type === 'field' &&
              node.data.bucketId === childData.bucketId &&
              node.data.measurement === childData.measurement &&
              node.data.field === childData.field) {
            // Check if this field has the tag
            return node.children.some(tag =>
              tag.type === 'tag' &&
              tag.data.tagKey === parentData.tagKey
            );
          }
          if (node.children) {
            const found = findFieldWithTag(node.children);
            if (found) return found;
          }
        }
        return false;
      };

      return findFieldWithTag(treeData);

    default:
      return false;
  }
}

/* ============ Data Tree Component ============ */
function DataTree({ buckets = [], onDragStart, onTreeDataUpdate }) {
  console.log('DataTree render - buckets:', buckets);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build tree data structure
  const buildTreeData = async () => {
    console.log('DataTree buildTreeData called, buckets:', buckets);
    if (!buckets || !buckets.length) {
      console.log('No buckets available, skipping tree build');
      setTreeData([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const tree = [];
      console.log('Building tree for', buckets.length, 'buckets');

      for (const bucket of buckets) {
        const bucketNode = {
          id: `bucket-${bucket.id}`,
          name: bucket.name,
          type: 'bucket',
          data: bucket,
          children: []
        };

        // Fetch measurements under this bucket
        try {
          const measurements = await fetchMeasurements(bucket.id);

          for (const measurement of measurements) {
            const measurementNode = {
              id: `measurement-${bucket.id}-${measurement}`,
              name: measurement,
              type: 'measurement',
              data: { bucketId: bucket.id, measurement },
              children: []
            };

            // Fetch fields and tags under this measurement
            try {
              const [fields, tagKeys] = await Promise.all([
                fetchFields(bucket.id, measurement),
                fetchTagKeys(bucket.id, measurement).catch(() => [])
              ]);

              const filteredTagKeys = tagKeys.filter(key =>
                !['_measurement', '_field', '_start', '_stop', '_time', '_value'].includes(key)
              );

              for (const field of fields) {
                const fieldNode = {
                  id: `field-${bucket.id}-${measurement}-${field}`,
                  name: field,
                  type: 'field',
                  data: { bucketId: bucket.id, measurement, field },
                  children: []
                };

                // Add tags as children of the field
                for (const tagKey of filteredTagKeys) {
                  const tagNode = {
                    id: `tag-${bucket.id}-${measurement}-${field}-${tagKey}`,
                    name: tagKey,
                    type: 'tag',
                    data: { bucketId: bucket.id, measurement, field, tagKey },
                    children: []
                  };
                  fieldNode.children.push(tagNode);
                }

                measurementNode.children.push(fieldNode);
              }

            } catch (e) {
              console.warn(`Failed to fetch fields for ${measurement}:`, e);
            }

            bucketNode.children.push(measurementNode);
          }
        } catch (e) {
          console.warn(`Failed to fetch measurements for bucket ${bucket.name}:`, e);
        }

        tree.push(bucketNode);
      }

      setTreeData(tree);
      if (onTreeDataUpdate) {
        onTreeDataUpdate(tree);
      }
    } catch (e) {
      console.error('Failed to build tree data:', e);
      setError(e);
      setTreeData([]); // Ensure we have valid data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buildTreeData();
  }, [buckets]);

  const handleToggle = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        <svg className="w-12 h-12 mx-auto mb-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-medium mb-2 text-red-700">Failed to Load Data</h3>
        <p className="text-sm text-red-600 mb-4">{error.message || 'An error occurred while loading the data tree.'}</p>
        <button
          onClick={() => {
            setError(null);
            buildTreeData();
          }}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-zinc-500">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <div className="text-sm">Loading data tree...</div>
        </div>
      </div>
    );
  }

  if (!treeData.length) {
    return (
      <div className="text-center text-zinc-500 py-8">
        <svg className="w-12 h-12 mx-auto mb-4 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14-4l-4 4 4 4M5 7l4 4-4 4" />
        </svg>
        <h3 className="text-lg font-medium mb-2">No Data Available</h3>
        <p className="text-sm">Connect to InfluxDB to explore your data structure.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-700">Original Data Structure</h3>
        <button
          onClick={buildTreeData}
          className="text-xs text-sky-600 hover:text-sky-700 px-2 py-1 rounded hover:bg-sky-50"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-1">
        {treeData.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            onDragStart={onDragStart}
            expandedNodes={expandedNodes}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}

/* ============ Child Drop Zone ============ */
function ChildDropZone({ parentId, level = 0, onDrop, onReorganize }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (dragData.isHierarchyNode) {
        // Handle internal hierarchy reorganization - append to parent's child list
        if (onReorganize) {
          onReorganize(dragData.id, parentId, 'on');
        }
      } else {
        // Handle new node dragged from the left tree
        onDrop(parentId, dragData);
      }
    } catch (err) {
      console.error('Failed to parse drop data:', err);
    }
  };

  return (
    <div
      className={`min-h-[32px] rounded-lg transition-all ${
        dragOver
          ? 'border-2 border-dashed border-sky-400 bg-sky-50'
          : 'border border-dashed border-transparent hover:border-gray-200'
      }`}
      style={{ marginLeft: `${level * 16}px` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver ? (
        <div className="flex items-center justify-center h-full text-sky-600 text-sm py-2">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add as child
        </div>
      ) : (
        <div className="h-full py-2 opacity-0 hover:opacity-40 transition-opacity">
          <div className="text-center text-xs text-gray-400">
            Drop zone
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Custom Hierarchy Node ============ */
function CustomHierarchyNode({ node, level = 0, onDrop, onRemove, onMoveUp, onMoveDown, onReorganize, treeData, onNodeSelect, selectedNodeId }) {
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dropPosition, setDropPosition] = useState(null); // 'before', 'on', 'after'

  const levelBoxClasses = (() => {
    switch (level) {
      case 0:
        return 'border-purple-300 bg-purple-50 hover:border-purple-400';
      case 1:
        return 'border-green-300 bg-green-50 hover:border-green-400';
      case 2:
        return 'border-blue-300 bg-blue-50 hover:border-blue-400';
      default:
        return 'border-gray-200 bg-white hover:border-gray-300';
    }
  })();

  const levelLabelClasses = (() => {
    switch (level) {
      case 0:
        return 'bg-purple-200 text-purple-900';
      case 1:
        return 'bg-green-200 text-green-900';
      case 2:
        return 'bg-blue-200 text-blue-900';
      default:
        return 'bg-blue-50 text-blue-600';
    }
  })();

  const handleDragStart = (e) => {
    e.stopPropagation();
    const dragData = {
      ...node,
      isHierarchyNode: true // Mark this as a node from within the hierarchy
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Determine drop position based on mouse location
    if (y < height * 0.2) {
      setDropPosition('parent'); // Top 20%: become parent level
    } else if (y > height * 0.8) {
      setDropPosition('after'); // Bottom 20%: become sibling after
    } else {
      setDropPosition('on'); // Middle 60%: become child
    }

    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const position = dropPosition;
    setDropPosition(null);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (dragData.isHierarchyNode) {
        // Handle internal hierarchy reorganization
        if (onReorganize) {
          onReorganize(dragData.id, node.id, position);
        }
      } else {
        // Handle new node dragged from the left tree
        if (position === 'on') {
          // Validate data relationship
          if (!validateDataRelationship(node, dragData, treeData)) {
            alert(`Invalid relationship: ${dragData.type} "${dragData.name}" cannot be placed under ${node.type} "${node.name}"`);
            return;
          }
          onDrop(node.id, dragData);
        } else {
          // For parent/after positions, need special handling
          if (onReorganize) {
            onReorganize(null, node.id, position, dragData);
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse drop data:', err);
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'bucket':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4-8-4m16 0v10l-8 4-8-4V7" />
          </svg>
        );
      case 'measurement':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'field':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      case 'tag':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="select-none relative">
      {/* Tree connection lines */}
      {level > 0 && (
        <div className="absolute left-0 top-0 w-full h-full pointer-events-none">
          {/* Horizontal line */}
          <div
            className="absolute h-px bg-gray-300 top-1/2"
            style={{
              left: `${(level - 1) * 24 + 12}px`,
              width: '12px'
            }}
          />
          {/* Vertical line - connect to parent */}
          <div
            className="absolute w-px bg-gray-300"
            style={{
              left: `${(level - 1) * 24 + 12}px`,
              top: '0px',
              height: '50%'
            }}
          />
          {/* Vertical line - connect to children */}
          {node.children && node.children.length > 0 && (
            <div
              className="absolute w-px bg-gray-300"
              style={{
                left: `${(level - 1) * 24 + 12}px`,
                top: '50%',
                height: '50%'
              }}
            />
          )}
        </div>
      )}

      {/* Parent node vertical connection line */}
      {level === 0 && node.children && node.children.length > 0 && (
        <div className="absolute left-0 top-0 w-full h-full pointer-events-none">
          <div
            className="absolute w-px bg-gray-300"
            style={{
              left: `${level * 24 + 12}px`,
              top: '50%',
              height: '50%'
            }}
          />
        </div>
      )}

      <div
        draggable
        className={`flex items-center gap-2 p-2 rounded-lg transition-all border cursor-grab active:cursor-grabbing relative ${
          dragOver
            ? dropPosition === 'parent'
              ? 'border-purple-400 border-t-4 border-t-purple-500 bg-purple-50'
              : dropPosition === 'after'
              ? 'border-green-400 border-b-4 border-b-green-500 bg-green-50'
              : 'border-blue-400 bg-blue-50'
            : `${levelBoxClasses} ${selectedNodeId === node.id ? 'border-blue-500 ring-1 ring-blue-200' : ''}`
        }`}
        style={{ marginLeft: `${level * 24}px` }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          // Only trigger selection when not dragging
          if (e.detail === 1 && onNodeSelect) { // single click
            onNodeSelect(node);
          }
        }}
      >
        {/* Level label */}
        <div className="flex items-center">
          {node.children && node.children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setExpanded(!expanded);
              }}
              className="mr-1 p-0.5 rounded hover:bg-gray-100"
            >
              <svg
                className={`w-3 h-3 transition-transform text-gray-500 ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelLabelClasses}`}>
            Level {level}
          </span>
        </div>

        {/* Node content */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate text-gray-900">{node.name}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onRemove(node.id)}
            className="text-red-400 hover:text-red-600 p-1"
            title="Remove"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drag hint */}
        {dragOver && (
          <div className="absolute inset-0 border-2 border-dashed border-sky-400 rounded-lg pointer-events-none"></div>
        )}
      </div>

      {/* Children area */}
      {expanded && node.children && node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <CustomHierarchyNode
              key={child.id}
              node={child}
              level={level + 1}
              onDrop={onDrop}
              onRemove={onRemove}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onReorganize={onReorganize}
              treeData={treeData}
              onNodeSelect={onNodeSelect}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Custom Hierarchy Builder ============ */
function CustomHierarchyBuilder({ customHierarchy, onUpdateHierarchy, treeData, onNodeSelect, selectedNodeId }) {
  const [dragOver, setDragOver] = useState(false);
  const [nextId, setNextId] = useState(1);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleRootDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    try {
      const nodeData = JSON.parse(e.dataTransfer.getData('text/plain'));

      if (nodeData.isHierarchyNode) {
        // If dragged from within hierarchy, ignore (should be handled by reorganize)
        return;
      }

      const newNode = {
        id: `custom-${nextId}`,
        ...nodeData,
        children: []
      };
      setNextId(prev => prev + 1);
      onUpdateHierarchy([...customHierarchy, newNode]);
    } catch (err) {
      console.error('Failed to parse drop data:', err);
    }
  };

  const handleNestedDrop = (parentId, nodeData) => {
    // Find parent node
    const findParentNode = (nodes, id) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findParentNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const parentNode = findParentNode(customHierarchy, parentId);

    // Validate data relationship
    if (!validateDataRelationship(parentNode, nodeData, treeData)) {
      alert(`Invalid relationship: ${nodeData.type} "${nodeData.name}" cannot be placed under ${parentNode?.type} "${parentNode?.name}"`);
      return;
    }

    const newNode = {
      id: `custom-${nextId}`,
      ...nodeData,
      children: []
    };
    setNextId(prev => prev + 1);

    const addToParent = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newNode]
          };
        }
        if (node.children) {
          return {
            ...node,
            children: addToParent(node.children)
          };
        }
        return node;
      });
    };

    onUpdateHierarchy(addToParent(customHierarchy));
  };

  const handleRemove = (nodeId) => {
    const removeNode = (nodes) => {
      return nodes.filter(node => {
        if (node.id === nodeId) {
          return false;
        }
        if (node.children) {
          node.children = removeNode(node.children);
        }
        return true;
      });
    };

    onUpdateHierarchy(removeNode(customHierarchy));
  };

  const handleMoveUp = (nodeId) => {
    const moveNodeUp = (nodes, parentArray = null, parentIndex = -1) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) {
          if (i > 0) {
            // Can move up: swap with previous node
            const newNodes = [...nodes];
            [newNodes[i], newNodes[i - 1]] = [newNodes[i - 1], newNodes[i]];
            return newNodes;
          }
          return nodes; // Already first, cannot move up
        }

        if (nodes[i].children && nodes[i].children.length > 0) {
          const newChildren = moveNodeUp(nodes[i].children, nodes, i);
          if (newChildren !== nodes[i].children) {
            return nodes.map((node, index) =>
              index === i ? { ...node, children: newChildren } : node
            );
          }
        }
      }
      return nodes;
    };

    onUpdateHierarchy(moveNodeUp(customHierarchy));
  };

  const handleMoveDown = (nodeId) => {
    const moveNodeDown = (nodes, parentArray = null, parentIndex = -1) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) {
          if (i < nodes.length - 1) {
            // Can move down: swap with next node
            const newNodes = [...nodes];
            [newNodes[i], newNodes[i + 1]] = [newNodes[i + 1], newNodes[i]];
            return newNodes;
          }
          return nodes; // Already last, cannot move down
        }

        if (nodes[i].children && nodes[i].children.length > 0) {
          const newChildren = moveNodeDown(nodes[i].children, nodes, i);
          if (newChildren !== nodes[i].children) {
            return nodes.map((node, index) =>
              index === i ? { ...node, children: newChildren } : node
            );
          }
        }
      }
      return nodes;
    };

    onUpdateHierarchy(moveNodeDown(customHierarchy));
  };

  const handleReorganize = (dragNodeId, targetNodeId, position, newNodeData = null) => {
    const newHierarchy = [...customHierarchy];

    if (newNodeData) {
      // New node dragged from left tree, insert at specified position
      const newNode = {
        id: `custom-${nextId}`,
        ...newNodeData,
        children: []
      };
      setNextId(prev => prev + 1);

      const insertNode = (nodes, targetId, pos) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === targetId) {
            if (pos === 'after') {
              nodes.splice(i + 1, 0, newNode);
            } else if (pos === 'parent') {
              // New node becomes the parent of the target node
              const targetNode = nodes.splice(i, 1)[0];
              newNode.children = [targetNode];
              nodes.splice(i, 0, newNode);
            }
            return true;
          }
          if (nodes[i].children && insertNode(nodes[i].children, targetId, pos)) {
            return true;
          }
        }
        return false;
      };

      insertNode(newHierarchy, targetNodeId, position);
      onUpdateHierarchy(newHierarchy);
      return;
    }

    // Internal hierarchy reorganization
    if (!dragNodeId || dragNodeId === targetNodeId) return;

    // Special handling: make dragged node the parent of target node
    if (position === 'parent') {
      let draggedNode = null;
      let targetNode = null;
      let targetParent = null;
      let targetIndex = -1;

      // 1. Find and remove the dragged node
      const removeDraggedNode = (nodes) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === dragNodeId) {
            draggedNode = nodes.splice(i, 1)[0];
            return true;
          }
          if (nodes[i].children && removeDraggedNode(nodes[i].children)) {
            return true;
          }
        }
        return false;
      };

      // 2. Find and remove the target node
      const removeTargetNode = (nodes, parent = null) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === targetNodeId) {
            targetNode = nodes.splice(i, 1)[0];
            targetParent = parent;
            targetIndex = i;
            return true;
          }
          if (nodes[i].children && removeTargetNode(nodes[i].children, nodes[i])) {
            return true;
          }
        }
        return false;
      };

      removeDraggedNode(newHierarchy);
      removeTargetNode(newHierarchy);

      if (!draggedNode || !targetNode) return;

      // 3. Create new parent-child relationship: draggedNode as parent, targetNode as child
      const newParentNode = {
        ...draggedNode,
        children: [...(draggedNode.children || []), targetNode]
      };

      // 4. Insert the new parent node at the original target position
      if (targetParent) {
        targetParent.children.splice(targetIndex, 0, newParentNode);
      } else {
        newHierarchy.splice(targetIndex, 0, newParentNode);
      }

      onUpdateHierarchy(newHierarchy);
      return;
    }

    // Normal reorganization logic
    // 1. Find and remove the dragged node
    let draggedNode = null;
    const removeDraggedNode = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === dragNodeId) {
          draggedNode = nodes.splice(i, 1)[0];
          return true;
        }
        if (nodes[i].children && removeDraggedNode(nodes[i].children)) {
          return true;
        }
      }
      return false;
    };

    removeDraggedNode(newHierarchy);
    if (!draggedNode) return;

    // 2. Insert at target position based on position
    const insertDraggedNode = (nodes, targetId, pos) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === targetId) {
          if (pos === 'before') {
            nodes.splice(i, 0, draggedNode);
          } else if (pos === 'after') {
            nodes.splice(i + 1, 0, draggedNode);
          } else if (pos === 'on') {
            // Become a child node
            if (!nodes[i].children) {
              nodes[i].children = [];
            }
            nodes[i].children.push(draggedNode);
          }
          return true;
        }
        if (nodes[i].children && insertDraggedNode(nodes[i].children, targetId, pos)) {
          return true;
        }
      }
      return false;
    };

    insertDraggedNode(newHierarchy, targetNodeId, position);
    onUpdateHierarchy(newHierarchy);
  };

  return (
    <div className="space-y-4">

      <div className="text-sm text-gray-600 space-y-1">
        <div>
          <p className="mb-3">Drag items from the left to build hierarchy</p>
          <div className="text-xs flex gap-4 w-full">
            <div className="flex-1">
              <div className="border-2 border-gray-200 border-t-purple-500 border-t-4 rounded h-6 flex items-center justify-center bg-white">
                <span className="text-purple-700 font-semibold text-[10px]">parent</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="border-2 border-blue-500 rounded h-6 flex items-center justify-center bg-white">
                <span className="text-blue-700 font-semibold text-[10px]">child</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="border-2 border-gray-200 border-b-green-500 border-b-4 rounded h-6 flex items-center justify-center bg-white">
                <span className="text-green-700 font-semibold text-[10px]">sibling</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Root-level drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 transition-all min-h-[300px] ${
          dragOver
            ? 'border-sky-400 bg-sky-50'
            : 'border-gray-300 bg-gray-50'
        } ${customHierarchy.length === 0 ? 'flex items-center justify-center' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleRootDrop}
      >
        {customHierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className={`w-12 h-12 mx-auto mb-4 ${
                dragOver ? 'text-sky-400' : 'text-gray-400'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h3 className={`text-lg font-medium mb-2 ${
              dragOver ? 'text-sky-600' : 'text-gray-600'
            }`}>
              {dragOver ? 'Drop Here' : 'Start Building'}
            </h3>
            <p className={`text-sm ${
              dragOver ? 'text-sky-500' : 'text-gray-500'
            }`}>
              Drag items from the tree to build your custom hierarchy
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {customHierarchy.map((node) => (
              <CustomHierarchyNode
                key={node.id}
                node={node}
                level={0}
                onDrop={handleNestedDrop}
                onRemove={handleRemove}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onReorganize={handleReorganize}
                treeData={treeData}
                onNodeSelect={onNodeSelect}
                selectedNodeId={selectedNodeId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Custom Dropdown Component ============ */
function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading,
  colorTheme = 'blue', // 'blue', 'green', 'orange', 'gray'
  fontSize = 'text-sm' // 'text-xs', 'text-sm', etc.
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeColors = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-white',
      focus: 'focus:ring-blue-400',
      hover: 'hover:border-blue-300',
      optionHover: 'hover:bg-blue-50',
      selectedBg: 'bg-blue-50',
      text: 'text-blue-700'
    },
    green: {
      border: 'border-green-200',
      bg: 'bg-white',
      focus: 'focus:ring-green-400',
      hover: 'hover:border-green-300',
      optionHover: 'hover:bg-green-50',
      selectedBg: 'bg-green-50',
      text: 'text-green-700'
    },
    orange: {
      border: 'border-orange-200',
      bg: 'bg-white',
      focus: 'focus:ring-orange-400',
      hover: 'hover:border-orange-300',
      optionHover: 'hover:bg-orange-50',
      selectedBg: 'bg-orange-50',
      text: 'text-orange-700'
    },
    gray: {
      border: 'border-gray-200',
      bg: 'bg-white',
      focus: 'focus:ring-gray-400',
      hover: 'hover:border-gray-300',
      optionHover: 'hover:bg-gray-50',
      selectedBg: 'bg-gray-50',
      text: 'text-gray-700'
    }
  };

  const theme = themeColors[colorTheme];
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-lg border ${theme.border} ${theme.bg} px-2.5 py-1 ${fontSize} transition-colors focus:outline-none focus:ring-1 ${theme.focus} ${theme.hover} disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border-neutral-200 text-left flex items-center justify-between`}
        disabled={disabled}
      >
        <span className={selectedOption ? theme.text : 'text-neutral-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md max-h-48 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-2.5 py-1 text-left ${fontSize} ${theme.optionHover} transition-colors ${
                option.value === value ? `${theme.selectedBg} ${theme.text} font-medium` : 'text-neutral-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ Tag Selector Component ============ */
function TagSelector({
  tagKeys,
  selectedTags,
  onTagChange,
  activeBucketId,
  selectedMeasurement,
  selectedField,
  setStatus
}) {

  const updateTagValues = async (index, values) => {
    const updated = [...selectedTags];
    updated[index] = { ...updated[index], values };

    // Cascade update: reload available values for subsequent tags
    if (index < selectedTags.length - 1) {
      try {
        setStatus('Updating cascade filters...');

        // Recalculate available values for each subsequent tag
        for (let i = index + 1; i < selectedTags.length; i++) {
          const tagToUpdate = updated[i];

          // Build cascade filter conditions: only use previously selected tag values
          const cascadeFilters = updated
            .slice(0, i)
            .filter(tag => tag.values && tag.values.length > 0)
            .map(tag => ({
              key: tag.key,
              values: tag.values
            }));

          const newAllValues = await fetchTagValues(activeBucketId, tagToUpdate.key, {
            measurement: selectedMeasurement,
            field: selectedField,
            filters: cascadeFilters
          });

          // Clear selections that are no longer valid
          const validValues = tagToUpdate.values.filter(v => newAllValues.includes(v));

          updated[i] = {
            ...tagToUpdate,
            allValues: newAllValues,
            values: validValues
          };
        }

        setStatus('Cascade filters updated');
      } catch (e) {
        setStatus('Cascade update error: ' + e.message);
      }
    }

    onTagChange(updated);
  };

  const removeTag = (index) => {
    const updated = selectedTags.filter((_, i) => i !== index);
    onTagChange(updated);
  };


  return (
    <div className="space-y-3">
      {/* Selected tags */}
      {selectedTags.map((tag, index) => (
        <div key={tag.key} className="relative">
          {/* Cascade connector line */}
          {index > 0 && (
            <div className="absolute -top-3 left-1/2 -ml-1 flex flex-col items-center">
              <div className="w-0.5 h-3 bg-gradient-to-b from-purple-300 to-purple-300"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full border-2 border-white shadow-sm"></div>
            </div>
          )}

          <div className="border border-purple-300 bg-purple-50/50 shadow-sm rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Cascade indicator */}
              <div className="flex items-center gap-1">
                {index > 0 && (
                  <div className="flex items-center text-purple-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-xs ml-1">filtered</span>
                  </div>
                )}
                <label className="text-sm font-medium text-purple-700">
                  {tag.key}
                </label>
              </div>

              <div className="flex items-center gap-1">
                {/* Selection status indicator */}
                {tag.values.length > 0 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
                    {tag.values.length} selected
                  </span>
                )}

                {/* Available options indicator */}
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-purple-50 text-purple-600 border border-purple-200">
                  {tag.allValues.length} options
                </span>
              </div>
            </div>

            <button
              onClick={() => removeTag(index)}
              className="text-yellow-600 hover:text-yellow-700 text-xs px-2 py-1 rounded hover:bg-yellow-50 transition-colors"
              title={`Remove ${tag.key} filter`}
            >
              ×
            </button>
          </div>

          <div className="w-full rounded-xl border border-purple-300 bg-white">
            {tag.allValues.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No values available</div>
            ) : (
              <>
                {/* Control buttons */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50/50">
                  <span className="text-xs text-gray-600">
                    {tag.values.length} of {tag.allValues.length} selected
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateTagValues(index, tag.allValues)}
                      className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-50"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTagValues(index, [])}
                      className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Options list */}
                <div className="px-3 py-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-1">
                    {tag.allValues.map((value, i) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-2 border-purple-300 text-white focus:ring-2 focus:ring-purple-400 focus:ring-offset-0 accent-purple-500"
                          checked={tag.values.includes(value)}
                          onChange={(e) => {
                            const newValues = e.target.checked
                              ? [...tag.values, value]
                              : tag.values.filter(v => v !== value);
                            updateTagValues(index, newValues);
                          }}
                        />
                        <span className="text-sm text-gray-700 select-none flex-1">{value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

          {/* Cascade effect hint */}
          {index < selectedTags.length - 1 && tag.values.length > 0 && (
            <div className="mt-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1">
              <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              This filter affects {selectedTags.length - index - 1} subsequent filter(s)
            </div>
          )}
        </div>
      ))}

    </div>
  );
}

/* ============ Left Query Builder ============ */
function LeftQueryBuilder({
  buckets, activeBucketId, setActiveBucketId,
  measurements, selectedMeasurement, setSelectedMeasurement,
  fields, selectedField, setSelectedField,
  range, setRange,
  onApply,
  tagKeys, selectedTags, setSelectedTags,
  groupOptions, groupBy, setGroupBy,
  loadingBuckets, loadingMeasurements, loadingFields,
  setStatus,
  visualizationType, setVisualizationType,
  aggregateFunction, setAggregateFunction,
  isEmbedded = false,
  onShowFlux,
  showFluxInWorkbench,
  setShowFluxInWorkbench
}) {
  const [activeSection, setActiveSection] = useState(null); // 'filter' or 'group' or null

  const addNewTagSelector = async (key) => {
    console.log('=== addNewTagSelector called ===');
    console.log('key:', key);
    console.log('activeBucketId:', activeBucketId);
    console.log('selectedTags before:', selectedTags);
    console.log('onTagChange function:', setSelectedTags);

    if (!key || !activeBucketId) return;

    try {
      setStatus(`Loading values for tag "${key}"...`);

      // Build cascade filter conditions: use selected tag values to filter available values for the new tag
      const cascadeFilters = selectedTags
        .filter(tag => tag.values && tag.values.length > 0)
        .map(tag => ({
          key: tag.key,
          values: tag.values
        }));

      const allValues = await fetchTagValues(activeBucketId, key, {
        measurement: selectedMeasurement,
        field: selectedField,
        filters: cascadeFilters // Pass cascade filter conditions
      });

      const newTag = {
        key,
        values: [],
        allValues
      };

      const updatedTags = [...selectedTags, newTag];
      console.log('newTag:', newTag);
      console.log('updatedTags:', updatedTags);
      setSelectedTags(updatedTags);
      setStatus(`Loaded ${allValues.length} values for tag "${key}" (cascade filtered)`);
    } catch (e) {
      setStatus('Load tag values error: ' + e.message);
    }
  };

  const containerClass = isEmbedded
    ? "h-full"
    : "bg-white border-r border-zinc-200 w-80 h-full overflow-y-auto";

  const contentClass = isEmbedded
    ? "p-4"
    : "p-3";

  return (
    <aside className={containerClass}>
      <div className={contentClass}>
        <div className="space-y-4">
          {/* Enhanced Bucket Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <label className="text-sm font-medium text-neutral-700">Bucket</label>
              {loadingBuckets && (
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  Loading...
                </div>
              )}
            </div>
            <CustomDropdown
              value={activeBucketId ?? ''}
              onChange={(value) => setActiveBucketId(value || null)}
              options={buckets.map(b => ({
                value: b.id,
                label: `${b.name} • ${String(b.id || '').slice(0, 6)}`
              }))}
              placeholder={loadingBuckets ? 'Loading buckets...' : 'Select a bucket'}
              disabled={loadingBuckets || !buckets.length}
              colorTheme="blue"
            />
          </div>

          {/* Enhanced Measurement Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <label className="text-sm font-medium text-neutral-700">Measurement</label>
              {loadingMeasurements && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <div className="w-3 h-3 border border-green-300 border-t-green-600 rounded-full animate-spin"></div>
                  Loading...
                </div>
              )}
            </div>
            <CustomDropdown
              value={selectedMeasurement}
              onChange={(value) => setSelectedMeasurement(value)}
              options={measurements.map(m => ({
                value: m,
                label: m
              }))}
              placeholder={loadingMeasurements ? 'Loading measurements...' : 'Select a measurement'}
              disabled={!activeBucketId || loadingMeasurements || !measurements.length}
              colorTheme="green"
            />
          </div>

          {/* Enhanced Field Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <label className="text-sm font-medium text-neutral-700">Field</label>
              {loadingFields && (
                <div className="flex items-center gap-1 text-xs text-orange-600">
                  <div className="w-3 h-3 border border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                  Loading...
                </div>
              )}
            </div>
            <CustomDropdown
              value={selectedField}
              onChange={(value) => setSelectedField(value)}
              options={fields.map(f => ({
                value: f,
                label: f
              }))}
              placeholder={loadingFields ? 'Loading fields...' : 'Select a field'}
              disabled={!selectedMeasurement || loadingFields || !fields.length}
              colorTheme="orange"
            />
          </div>
          {/* Enhanced Filter/Group Selector */}
          {selectedMeasurement && selectedField && (
            <div className="space-y-3">
              {/* Query Enhancement Section */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <div className="text-sm font-medium text-neutral-700">Tag</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ring-1 ring-inset ${
                      activeSection === 'filter'
                        ? 'bg-purple-600 text-white shadow-lg ring-purple-600'
                        : 'bg-white text-purple-700 ring-purple-200'
                    }`}
                    onClick={() => setActiveSection(activeSection === 'filter' ? null : 'filter')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                    </svg>
                    <span>Filter</span>
                    <span className="inline-flex items-center rounded-full bg-white/80 px-1.5 py-0.5 text-xs font-medium text-purple-700 ml-1">
                      {selectedTags.length}
                    </span>
                  </button>
                  <button
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ring-1 ring-inset ${
                      activeSection === 'group'
                        ? 'bg-yellow-400 text-white shadow-lg ring-yellow-400'
                        : 'bg-white text-yellow-700 ring-yellow-200 hover:bg-yellow-50'
                    }`}
                    onClick={() => setActiveSection(activeSection === 'group' ? null : 'group')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7l2 2-2 2m0 8l2 2-2 2M9 7l2 2-2 2" />
                    </svg>
                    <span>Group</span>
                    {groupBy.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-white/80 px-1.5 py-0.5 text-xs font-medium text-yellow-700 ml-1">
                        {groupBy.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Filter area */}
              {activeSection === 'filter' && (
                <div className="border border-purple-200 rounded-xl bg-purple-50/30 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                      </svg>
                      <span className="text-sm font-medium text-purple-800">Tag Filters</span>
                    </div>
                    <button
                      onClick={() => setActiveSection(null)}
                      className="text-purple-600 hover:text-purple-800 text-xs"
                    >
                      ×
                    </button>
                  </div>

                  {/* Selected filters */}
                  {console.log('Rendering filters, selectedTags.length:', selectedTags.length, 'selectedTags:', selectedTags)}
                  {selectedTags.length > 0 && (
                    <div className="mb-3">
                      <TagSelector
                        tagKeys={tagKeys}
                        selectedTags={selectedTags}
                        onTagChange={setSelectedTags}
                        activeBucketId={activeBucketId}
                        selectedMeasurement={selectedMeasurement}
                        selectedField={selectedField}
                        setStatus={setStatus}
                      />
                    </div>
                  )}


                  {/* Available Tag Keys */}
                  {tagKeys.filter(key =>
                    !['_measurement', '_field', '_start', '_stop', '_time', '_value'].includes(key) &&
                    !selectedTags.some(tag => tag.key === key)
                  ).length > 0 && (
                    <div>
                      <div className="mb-2 text-sm text-purple-700">Available Tags (click to add)</div>
                      <div className="flex flex-wrap gap-1">
                        {tagKeys.filter(key =>
                          !['_measurement', '_field', '_start', '_stop', '_time', '_value'].includes(key) &&
                          !selectedTags.some(tag => tag.key === key)
                        ).map((key, i) => (
                          <button
                            key={key}
                            className="inline-flex items-center rounded-lg bg-white border border-purple-200 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-300"
                            onClick={() => addNewTagSelector(key)}
                          >
                            + {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTags.length === 0 && tagKeys.filter(key =>
                    !['_measurement', '_field', '_start', '_stop', '_time', '_value'].includes(key)
                  ).length === 0 && (
                    <div className="text-center text-purple-600 text-sm py-4">
                      <div>No tags available for filtering</div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Group area */}
              {activeSection === 'group' && (
                <div className="border border-yellow-200 rounded-xl bg-yellow-50/30 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7l2 2-2 2m0 8l2 2-2 2M9 7l2 2-2 2" />
                      </svg>
                      <span className="text-sm font-medium text-yellow-800">Group By Fields</span>
                    </div>
                    <button
                      onClick={() => setActiveSection(null)}
                      className="text-yellow-600 hover:text-yellow-800 text-xs"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm text-yellow-700">Select fields to group your data by:</div>

                    <div className="w-full rounded-lg border border-yellow-300 bg-white">
                      {groupOptions.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">No grouping options available</div>
                      ) : (
                        <>
                          {/* Control buttons */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-yellow-50/50">
                            <span className="text-xs text-gray-600">
                              {groupBy.length} of {groupOptions.length} selected
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setGroupBy(groupOptions)}
                                className="text-xs text-yellow-600 hover:text-yellow-800 px-2 py-1 rounded hover:bg-yellow-50"
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => setGroupBy([])}
                                className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="px-3 py-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                            <div className="space-y-1">
                              {groupOptions.map((col, i) => (
                                <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-1">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-2 border-yellow-300 focus:ring-2 focus:ring-yellow-400 accent-yellow-500 focus:ring-offset-0"
                                    checked={groupBy.includes(col)}
                                    onChange={(e) => {
                                      const newGroupBy = e.target.checked
                                        ? [...groupBy, col]
                                        : groupBy.filter(c => c !== col);
                                      setGroupBy(newGroupBy);
                                    }}
                                  />
                                  <span className="text-sm text-gray-700 select-none flex-1">{col}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-yellow-600">
                      Select multiple fields to group your data
                    </div>
                  </div>
                </div>
              )}

              {/* Current selection summary */}
              {(selectedTags.length > 0 || groupBy.length > 0) && (
                <div className="p-3 border border-zinc-200 rounded-xl bg-white">
                  <div className="text-sm font-medium text-zinc-700 mb-2">Query Summary</div>
                  <div className="space-y-1 text-xs text-zinc-600">
                    <div><strong>{selectedMeasurement}</strong>.{selectedField}</div>
                    {selectedTags.length > 0 && (
                      <div>Filters: {selectedTags.map(tag => `${tag.key}(${tag.values.length})`).join(', ')}</div>
                    )}
                    {groupBy.length > 0 && (
                      <div>Group by: {groupBy.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aggregation Function Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700">Aggregation</label>
            <CustomDropdown
              value={aggregateFunction}
              onChange={(value) => setAggregateFunction(value)}
              options={[
                { value: "mean", label: "Mean (Average)" },
                { value: "sum", label: "Sum" },
                { value: "max", label: "Maximum" },
                { value: "min", label: "Minimum" },
                { value: "median", label: "Median" },
                { value: "last", label: "Last Value" },
                { value: "first", label: "First Value" },
                { value: "count", label: "Count" },
                { value: "stddev", label: "Standard Deviation" }
              ]}
              placeholder="Select aggregation"
              colorTheme="gray"
            />
          </div>

          <div className="mt-1 flex gap-2">
            <button
              onClick={() => {
                onApply();
              }}
              disabled={!activeBucketId || !selectedMeasurement || !selectedField}
              className="inline-flex items-center rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              Submit
            </button>
            <button
              onClick={() => {
                const next = !showFluxInWorkbench;
                if (setShowFluxInWorkbench) {
                  setShowFluxInWorkbench(next);
                }
                if (next && onShowFlux) {
                  onShowFlux();
                }
              }}
              className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400 transition-all duration-200 ${
                showFluxInWorkbench
                  ? 'bg-green-100 bg-opacity-60 text-green-800 border border-green-300 hover:bg-green-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {showFluxInWorkbench ? 'Hide Flux' : 'Show Flux'}
            </button>
            <button
              onClick={() => {
                setActiveBucketId(null);
                setSelectedMeasurement('');
                setSelectedField('');
                setSelectedTags([]);
                setRange('-1h');
              }}
              className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ============ Direct Data Chart Panel ============ */
function GrafanaPanel({
  measurement,
  selectedField,
  selectedTags,
  range,
  visualizationType,
  bucketName,
  isCrossMeasurement,
  customFlux,
  selectedFields,
  measurements,
  onVisualizationTypeChange,
  instanceId = 'default',
  panelLabel = 'Grafana Dashboard'
}) {
  const [dynamicDashboardUrl, setDynamicDashboardUrl] = useState('');
  const [isDynamicDashboard, setIsDynamicDashboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVizDropdownOpen, setIsVizDropdownOpen] = useState(false);
  const vizDropdownRef = useRef(null);

  const visualizations = [
    {
      id: 'timeseries',
      name: 'Time series',
      description: 'Time based line, area and bar charts',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 20h18M3 4h18" />
        </svg>
      )
    },
    {
      id: 'barchart',
      name: 'Bar chart',
      description: 'Categorical charts with group support',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="12" width="3" height="8" />
          <rect x="7" y="8" width="3" height="12" />
          <rect x="11" y="6" width="3" height="14" />
          <rect x="15" y="10" width="3" height="10" />
          <rect x="19" y="4" width="3" height="16" />
        </svg>
      )
    },
    {
      id: 'stat',
      name: 'Stat',
      description: 'Big stat values & sparklines',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l3-3 3 3v13M9 9h6" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
          <circle cx="17" cy="17" r="1" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'gauge',
      name: 'Gauge',
      description: 'Standard gauge visualization',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
          <circle cx="12" cy="12" r="6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'table',
      name: 'Table',
      description: 'Supports many column styles',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      )
    },
    {
      id: 'piechart',
      name: 'Pie chart',
      description: 'The new core pie chart visualization',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2v8l6.928 4A8 8 0 1112 4z" />
          <path d="M12 4a8 8 0 016.928 12L12 12V4z" fill="currentColor" fillOpacity="0.6" />
        </svg>
      )
    },
    {
      id: 'heatmap',
      name: 'Heatmap',
      description: 'Like a histogram over time',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="2" width="4" height="4" fillOpacity="0.3" />
          <rect x="6" y="2" width="4" height="4" fillOpacity="0.6" />
          <rect x="10" y="2" width="4" height="4" fillOpacity="0.9" />
          <rect x="14" y="2" width="4" height="4" fillOpacity="0.4" />
          <rect x="18" y="2" width="4" height="4" fillOpacity="0.7" />
          <rect x="2" y="6" width="4" height="4" fillOpacity="0.8" />
          <rect x="6" y="6" width="4" height="4" fillOpacity="0.2" />
          <rect x="10" y="6" width="4" height="4" fillOpacity="0.5" />
          <rect x="14" y="6" width="4" height="4" fillOpacity="1" />
          <rect x="18" y="6" width="4" height="4" fillOpacity="0.3" />
          <rect x="2" y="10" width="4" height="4" fillOpacity="0.6" />
          <rect x="6" y="10" width="4" height="4" fillOpacity="0.9" />
          <rect x="10" y="10" width="4" height="4" fillOpacity="0.2" />
          <rect x="14" y="10" width="4" height="4" fillOpacity="0.7" />
          <rect x="18" y="10" width="4" height="4" fillOpacity="0.8" />
        </svg>
      )
    },
    {
      id: 'histogram',
      name: 'Histogram',
      description: 'Bucketized value distribution',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="16" width="2" height="6" />
          <rect x="5" y="12" width="2" height="10" />
          <rect x="8" y="8" width="2" height="14" />
          <rect x="11" y="10" width="2" height="12" />
          <rect x="14" y="6" width="2" height="16" />
          <rect x="17" y="14" width="2" height="8" />
          <rect x="20" y="18" width="2" height="4" />
        </svg>
      )
    }
  ];

  // Click outside handler for visualization dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vizDropdownRef.current && !vizDropdownRef.current.contains(event.target)) {
        setIsVizDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeFilters = Array.isArray(selectedTags)
    ? selectedTags.filter(tag => tag.values && tag.values.length > 0)
    : [];

  const hasFilters = activeFilters.length > 0;

  const normalizedBaseLabel = panelLabel || 'Grafana Dashboard';

  const defaultDashboardTitle = normalizedBaseLabel;

  const [userTitle, setUserTitle] = useState(defaultDashboardTitle);
  const [hasCustomTitle, setHasCustomTitle] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState('');
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (!hasCustomTitle) {
      setUserTitle(defaultDashboardTitle);
    }
  }, [defaultDashboardTitle, hasCustomTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      setTitleInputValue(userTitle?.trim() || defaultDashboardTitle || normalizedBaseLabel);
    }
  }, [isEditingTitle, userTitle, defaultDashboardTitle, normalizedBaseLabel]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const displayTitle = userTitle?.trim() || defaultDashboardTitle || normalizedBaseLabel;

  const commitTitle = () => {
    const trimmed = titleInputValue.trim();
    if (trimmed) {
      setUserTitle(trimmed);
      setHasCustomTitle(true);
    } else {
      setHasCustomTitle(false);
      setUserTitle(defaultDashboardTitle);
    }
    setIsEditingTitle(false);
  };

  const handleRenameDashboard = () => {
    setTitleInputValue(displayTitle);
    setIsEditingTitle(true);
  };

  const handleResetTitle = () => {
    setHasCustomTitle(false);
    setUserTitle(defaultDashboardTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditingTitle(false);
    }
  };

  // Create stable dependency values to prevent unnecessary re-renders
  const activeFiltersKey = useMemo(() =>
    activeFilters.map(f => `${f.key}:${f.values?.join(',')}`).join('|'),
    [activeFilters]
  );

  const selectedFieldsKey = useMemo(() =>
    selectedFields?.join(',') || '',
    [selectedFields]
  );

  const measurementsKey = useMemo(() =>
    measurements?.join(',') || '',
    [measurements]
  );

  // Create a stable iframe key that only changes when necessary
  const iframeKey = useMemo(() => {
    return `iframe-${measurement || 'cross'}-${selectedFieldsKey}-${activeFiltersKey}-${visualizationType}-${range}`;
  }, [measurement, selectedFieldsKey, activeFiltersKey, visualizationType, range]);

  // Function to create a dynamic dashboard
  const createDynamicDashboard = async () => {
    // For cross-measurement queries, we need at least selectedFields
    // For regular queries, we need measurement and selectedField
    if (isCrossMeasurement && (!selectedFields || selectedFields.length === 0)) return;
    if (!isCrossMeasurement && (!measurement || !selectedField)) return;

    setLoading(true);
    try {
      const customTitle = displayTitle;
      let requestBody;

      if (isCrossMeasurement) {
        // Cross-measurement query
        requestBody = {
          isCrossMeasurement: true,
          customFlux: customFlux,
          fields: selectedFields,
          measurements: measurements,
          tags: activeFilters.map(filter => ({
            key: filter.key,
            values: filter.values
          })),
          visualizationType: visualizationType || 'timeseries',
          timeRange: range,
          aggregateWindow: getAggregateWindow(range),
          customTitle
        };
      } else {
        // Single measurement query
        requestBody = {
          measurement,
          field: selectedField,
          tags: activeFilters.map(filter => ({
            key: filter.key,
            values: filter.values
          })),
          visualizationType: visualizationType || 'timeseries',
          timeRange: range,
          aggregateWindow: getAggregateWindow(range),
          customTitle
        };
      }

      console.log('Creating dashboard with request body:', requestBody);

      const response = await fetch('/api/create-filtered-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        setDynamicDashboardUrl(result.grafanaUrl);
        setIsDynamicDashboard(true);
      } else {
        console.error('Failed to create dynamic dashboard');
        setIsDynamicDashboard(false);
      }
    } catch (error) {
      console.error('Error creating dynamic dashboard:', error);
      setIsDynamicDashboard(false);
    } finally {
      setLoading(false);
    }
  };


  // Create dynamic dashboard for all queries, ensuring time range and aggregation are correct
  useEffect(() => {
    if (isEditingTitle) return;
    const shouldCreateDashboard = isCrossMeasurement
      ? (selectedFields && selectedFields.length > 0 && customFlux)
      : (measurement && selectedField);

    if (shouldCreateDashboard) {
      createDynamicDashboard();
    } else {
      setIsDynamicDashboard(false);
      setDynamicDashboardUrl('');
    }
  }, [
    measurement,
    selectedField,
    activeFiltersKey,
    visualizationType,
    range,
    isCrossMeasurement,
    selectedFieldsKey,
    customFlux,
    measurementsKey,
    displayTitle,
    isEditingTitle
  ]);

  // Debug info
  console.log('=== GrafanaPanel Debug ===');
  console.log('isCrossMeasurement:', isCrossMeasurement);
  console.log('selectedFields:', selectedFields);
  console.log('measurements:', measurements);
  console.log('customFlux:', customFlux);
  console.log('isDynamicDashboard:', isDynamicDashboard);
  console.log('dynamicDashboardUrl:', dynamicDashboardUrl);
  console.log('range:', range);
  console.log('activeFilters.length:', activeFilters.length);
  console.log('=========================');

  const hasValidQuery = isCrossMeasurement
    ? (selectedFields && selectedFields.length > 0)
    : (measurement && selectedField);

  if (!hasValidQuery) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04),_0_10px_20px_-10px_rgb(0_0_0_/_0.12)] border border-zinc-200">
        <div className="h-11 px-3 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={titleInputValue}
                onChange={(e) => setTitleInputValue(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
                className="text-sm text-zinc-800 border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : (
              <strong className="text-sm text-zinc-800">{displayTitle}</strong>
            )}
            {!isEditingTitle && (
              <button
                onClick={handleRenameDashboard}
                className="inline-flex items-center justify-center text-zinc-500 hover:text-zinc-700 transition-colors"
                title="Rename dashboard"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L7.5 20.5l-4 1 1-4 10.768-10.768z" />
                </svg>
              </button>
            )}
            {hasCustomTitle && !isEditingTitle && (
              <button
                onClick={handleResetTitle}
                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                title="Reset to default"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex gap-1 relative" ref={vizDropdownRef}>
          </div>
        </div>
        <div className="h-[320px] flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <div className="font-medium">
              {isCrossMeasurement ? 'Select fields to query' : 'Select measurement and field'}
            </div>
            <div className="text-sm mt-1">Choose parameters to view Grafana dashboard</div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04),_0_10px_20px_-10px_rgb(0_0_0_/_0.12)] border border-zinc-200">
      <div className="h-11 px-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleInputValue}
              onChange={(e) => setTitleInputValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="text-sm text-zinc-800 border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          ) : (
            <strong className="text-sm text-zinc-800">{displayTitle}</strong>
          )}
          {!isEditingTitle && (
            <button
              onClick={handleRenameDashboard}
              className="inline-flex items-center justify-center text-zinc-500 hover:text-zinc-700 transition-colors"
              title="Rename dashboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L7.5 20.5l-4 1 1-4 10.768-10.768z" />
              </svg>
            </button>
          )}
          {hasCustomTitle && !isEditingTitle && (
            <button
              onClick={handleResetTitle}
              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
              title="Reset to default"
            >
              Reset
            </button>
          )}
          {hasFilters && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {isDynamicDashboard ? 'Multi-Filter' : 'Filtered'}
            </span>
          )}
          {loading && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              Creating...
            </span>
          )}
        </div>
        <div className="flex gap-1 relative" ref={vizDropdownRef}>
          {(onVisualizationTypeChange || visualizationType) && (
            <>
              <button
                onClick={() => setIsVizDropdownOpen(!isVizDropdownOpen)}
                className="flex items-center justify-between text-xs border border-blue-300 rounded px-2 py-1 bg-white text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-200 w-36 relative z-10"
                style={{opacity: 1, visibility: 'visible', position: 'relative', display: 'flex', zIndex: 9999}}
              >
                <div className="flex items-center gap-1">
                  {visualizations.find(v => v.id === (visualizationType || 'timeseries'))?.icon}
                  <span>{visualizations.find(v => v.id === (visualizationType || 'timeseries'))?.name}</span>
                </div>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isVizDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-zinc-200 rounded-lg shadow-lg z-[9999] max-h-80 overflow-y-auto">
                  {visualizations.map((viz) => (
                    <button
                      key={viz.id}
                      onClick={() => {
                        if (onVisualizationTypeChange) {
                          onVisualizationTypeChange(viz.id);
                        }
                        setIsVizDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 transition-colors ${
                        (visualizationType || 'timeseries') === viz.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="text-zinc-600">{viz.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900 text-xs">{viz.name}</div>
                      </div>
                      {(visualizationType || 'timeseries') === viz.id && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="h-[320px]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-zinc-500">
              <div className="font-medium">Creating Dynamic Dashboard</div>
              <div className="text-sm mt-1">Building multi-filter query...</div>
            </div>
          </div>
        ) : dynamicDashboardUrl ? (
          <iframe
            key={iframeKey}
            src={dynamicDashboardUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Grafana Panel"
            className="border-0"
            allow="fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            Unable to build Grafana embed URL. Check configuration.
          </div>
        )}
      </div>
      <div className="h-12 px-2 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
        <span className="flex gap-1 flex-wrap">
          {bucketName && (
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-xs">
              {bucketName}
            </span>
          )}
          {measurement && (
            <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 px-1.5 py-0.5 text-xs">
              {measurement}
            </span>
          )}
          {selectedTags.slice(0, 2).map((tag, i) => (
            <span key={i} className="inline-flex items-center rounded-md border border-zinc-200 bg-white text-zinc-700 px-1.5 py-0.5 text-xs">
              {tag.key}: {tag.values.slice(0, 1).join(', ')}{tag.values.length > 1 ? '...' : ''}
            </span>
          ))}
          <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 text-purple-700 px-1.5 py-0.5 text-xs">
            {range}
          </span>
        </span>

        {/* Open in Grafana Button */}
        {dynamicDashboardUrl && (
          <button
            onClick={() => {
              // Convert iframe URL to dashboard edit URL
              const editDashboardUrl = dynamicDashboardUrl
                .replace('/d-solo/', '/d/')
                .replace('&kiosk=true', '')
                .replace('&kiosk', '')
                + '&editPanel=1';
              window.open(editDashboardUrl, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors whitespace-nowrap"
            title="Open in Grafana"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Grafana
          </button>
        )}
      </div>
    </div>
  );
}

/* ============ Main Workbench Grid ============ */
function Workbench({ selectedMeasurement, selectedField, selectedTags, range, bucketName, visualizationType, setVisualizationType, showFlux, fluxText, onCloseFlux, activeModule, customHierarchy, onUpdateHierarchy, treeData, buckets, selectedHierarchyNode, setSelectedHierarchyNode, hierarchyFluxText, setHierarchyFluxText, hierarchyVisualizationType, setHierarchyVisualizationType, showFluxInWorkbench, setShowFluxInWorkbench, savedHierarchyDefinition, setSavedHierarchyDefinition, hierarchyQuerySelection, setHierarchyQuerySelection, activeHierarchyTab, setActiveHierarchyTab, isCustomHierarchyCollapsed, setIsCustomHierarchyCollapsed, isSavedHierarchyCollapsed, setIsSavedHierarchyCollapsed }) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [isVizDropdownOpen, setIsVizDropdownOpen] = useState(false);
  const vizDropdownRef = useRef(null);

  // Add default aggregateFunction
  const aggregateFunction = 'mean';

  // Hierarchy-specific visualization dropdown state
  const [isHierarchyVizDropdownOpen, setIsHierarchyVizDropdownOpen] = useState(false);
  const hierarchyVizDropdownRef = useRef(null);

  const visualizations = [
    { id: 'timeseries', name: 'Time series', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" /></svg> },
    { id: 'barchart', name: 'Bar chart', icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="12" width="3" height="8" /><rect x="7" y="8" width="3" height="12" /><rect x="11" y="6" width="3" height="14" /><rect x="15" y="10" width="3" height="10" /><rect x="19" y="4" width="3" height="16" /></svg> },
    { id: 'stat', name: 'Stat', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l3-3 3 3v13M9 9h6" /></svg> },
    { id: 'gauge', name: 'Gauge', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" /></svg> },
    { id: 'table', name: 'Table', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1z" /></svg> },
    { id: 'piechart', name: 'Pie chart', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /></svg> },
    { id: 'heatmap', name: 'Heatmap', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg> },
    { id: 'histogram', name: 'Histogram', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (vizDropdownRef.current && !vizDropdownRef.current.contains(event.target)) {
        setIsVizDropdownOpen(false);
      }
      if (hierarchyVizDropdownRef.current && !hierarchyVizDropdownRef.current.contains(event.target)) {
        setIsHierarchyVizDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyFlux = async () => {
    try {
      const textToCopy = activeModule === 'hierarchy' ? hierarchyFluxText : fluxText;
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy flux query:', err);
    }
  };

  // If a measurement is selected, show the corresponding Grafana panel
  const hasQuery = selectedMeasurement && selectedField;

  // If in hierarchy module, show custom hierarchy builder and charts
  if (activeModule === 'hierarchy') {
    const handleNodeSelect = (node) => {
      setSelectedHierarchyNode(node);
      // Generate Flux query
      const flux = generateHierarchyFlux(node, customHierarchy, range, buckets, aggregateFunction);
      setHierarchyFluxText(flux);
    };

    const hasHierarchyQuery = (hierarchyFluxText && hierarchyFluxText.length > 0) ||
                              (hierarchyQuerySelection && hierarchyQuerySelection.measurement);

    return (
      <div className="p-3 grid grid-cols-12 gap-3 min-h-full">
        {/* Left: Custom Hierarchy */}
        <div className="col-span-5 flex flex-col gap-3">
          {/* Custom Hierarchy Builder */}
          <div className="space-y-4">
          {/* Custom Hierarchy Builder */}
          <div>
            <div
              className="h-12 rounded-xl bg-gradient-to-r from-blue-50 to-transparent border border-dashed border-blue-100 flex items-center px-3 text-base font-bold text-blue-700 cursor-pointer"
              onClick={() => setIsCustomHierarchyCollapsed(!isCustomHierarchyCollapsed)}
            >
              <svg
                className={`w-5 h-5 mr-2 transition-transform ${isCustomHierarchyCollapsed ? '-rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Custom Hierarchy</span>
            </div>

            {!isCustomHierarchyCollapsed && (
              <div className="mt-4">
                <CustomHierarchyBuilder
                  customHierarchy={customHierarchy}
                  onUpdateHierarchy={onUpdateHierarchy}
                  treeData={treeData}
                  onNodeSelect={handleNodeSelect}
                  selectedNodeId={selectedHierarchyNode?.id}
                />

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      console.log('Saving hierarchy:', customHierarchy);
                      if (!customHierarchy || customHierarchy.length === 0) {
                        console.warn('Cannot save empty hierarchy');
                        return;
                      }
                      try {
                        const hierarchyStr = JSON.stringify(customHierarchy);
                        localStorage.setItem('savedHierarchyDefinition', hierarchyStr);
                        setSavedHierarchyDefinition(customHierarchy);
                        setIsCustomHierarchyCollapsed(true); // Collapse custom hierarchy after saving
                        setIsSavedHierarchyCollapsed(false); // Expand saved hierarchy query after saving
                        console.log('Successfully saved hierarchy:', customHierarchy);
                        console.log('Hierarchy definition saved successfully!');
                      } catch (e) {
                        console.error('Failed to save hierarchy:', e);
                      }
                    }}
                    disabled={customHierarchy.length === 0}
                    className="inline-flex flex-1 items-center rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-400 justify-center"
                  >
                    Save Hierarchy Definition
                  </button>
                  {customHierarchy.length > 0 && (
                    <button
                      onClick={() => onUpdateHierarchy([])}
                      className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Saved Hierarchy Query */}
          <div>
            <div
              className="h-12 rounded-xl bg-gradient-to-r from-purple-50 to-transparent border border-dashed border-purple-100 flex items-center px-3 text-base font-bold text-purple-700 cursor-pointer"
              onClick={() => setIsSavedHierarchyCollapsed(!isSavedHierarchyCollapsed)}
            >
              <svg
                className={`w-4 h-4 mr-2 transition-transform ${isSavedHierarchyCollapsed ? '-rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>Saved Hierarchy Query</span>
            </div>
            {!isSavedHierarchyCollapsed && (
              <>
                {savedHierarchyDefinition ? (
                  <SavedHierarchyQueryForm
                    savedHierarchy={savedHierarchyDefinition}
                    buckets={buckets}
                    hierarchyQuerySelection={hierarchyQuerySelection}
                    setHierarchyQuerySelection={setHierarchyQuerySelection}
                    range={range}
                    showFluxInWorkbench={showFluxInWorkbench}
                    setShowFluxInWorkbench={setShowFluxInWorkbench}
                    setHierarchyFluxText={setHierarchyFluxText}
                    hierarchyVisualizationType={hierarchyVisualizationType}
                  />
                ) : (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 mt-2">
                    <div className="text-center text-purple-600">
                      <svg className="w-12 h-12 mx-auto mb-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm font-medium">No saved hierarchy definitions</p>
                      <p className="text-xs text-purple-500 mt-1">Create and save a custom hierarchy above to see it here</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        </div>

        {/* Right: Dashboard */}
        <div className="col-span-7 flex-1">
            <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] border border-slate-200/60 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Grafana Dashboard</h3>
              </div>
            {hasHierarchyQuery ? (
              <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">

              {/* Selected node info */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-emerald-800">Query Summary</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><span className="font-medium">Measurement:</span> {(() => {
                    const measurement = selectedHierarchyNode ? (getNodeMeasurement(selectedHierarchyNode, customHierarchy) || 'Not found') : (hierarchyQuerySelection?.measurement || 'Not found');
                    if (measurement === 'cross_measurement') {
                      const measurements = selectedHierarchyNode ? [] : (hierarchyQuerySelection?.measurements || []);
                      return measurements.length > 0 ? measurements.join(', ') : 'Multiple measurements';
                    }
                    return measurement;
                  })()}</div>
                  <div><span className="font-medium">Fields:</span> {selectedHierarchyNode ? (getNodeFields(selectedHierarchyNode, customHierarchy).join(', ') || 'Not found') : (hierarchyQuerySelection?.selectedFields?.join(', ') || hierarchyQuerySelection?.selectedField || 'Not found')}</div>
                  <div><span className="font-medium">Bucket:</span> {selectedHierarchyNode ? (buckets.find(b => b.id === getNodeBucketId(selectedHierarchyNode, customHierarchy))?.name || 'Not found') : (hierarchyQuerySelection?.bucketName || 'Not found')}</div>
                  <div><span className="font-medium">Tags:</span> {(() => {
                    const tags = selectedHierarchyNode ? getNodeTags(selectedHierarchyNode, customHierarchy) : (hierarchyQuerySelection?.selectedTags || []);
                    if (Array.isArray(tags) && tags.length > 0) {
                      return tags.map(tag => {
                        if (tag.values && Array.isArray(tag.values) && tag.values.length > 0) {
                          return `${tag.key}="${tag.values.join(', ')}"`;
                        } else if (tag.value) {
                          return `${tag.key}="${tag.value}"`;
                        }
                        return `${tag.key}="..."`;
                      }).join(', ');
                    } else if (typeof tags === 'object' && Object.keys(tags).length > 0) {
                      return Object.entries(tags).map(([key, value]) => `${key}="${value}"`).join(', ');
                    }
                    return 'No filters';
                  })()}</div>
                </div>
              </div>

              {/* Chart panel */}
              <GrafanaPanel
                key="hierarchy-panel"
                measurement={
                  selectedHierarchyNode
                    ? (selectedHierarchyNode.data?.measurement || getNodeMeasurement(selectedHierarchyNode, customHierarchy))
                    : hierarchyQuerySelection?.measurement
                }
                selectedField={
                  selectedHierarchyNode
                    ? getNodeField(selectedHierarchyNode, customHierarchy)
                    : hierarchyQuerySelection?.selectedField
                }
                bucketName={
                  selectedHierarchyNode
                    ? buckets.find(b => b.id === (selectedHierarchyNode.data?.bucketId || getNodeBucketId(selectedHierarchyNode, customHierarchy)))?.name
                    : hierarchyQuerySelection?.bucketName
                }
                selectedTags={
                  selectedHierarchyNode
                    ? getNodeTags(selectedHierarchyNode, customHierarchy)
                    : hierarchyQuerySelection?.selectedTags || []
                }
                range={
                  selectedHierarchyNode
                    ? range
                    : hierarchyQuerySelection?.range || range
                }
                visualizationType={hierarchyVisualizationType}
                isCrossMeasurement={hierarchyQuerySelection?.isCrossMeasurement}
                customFlux={hierarchyQuerySelection?.flux}
                selectedFields={hierarchyQuerySelection?.selectedFields}
              measurements={hierarchyQuerySelection?.measurements}
              onVisualizationTypeChange={setHierarchyVisualizationType}
              instanceId="hierarchy"
            />
            </div>
            ) : (
              <div className="flex items-center justify-center text-center py-12">
                <div>
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14-7l2 2-2 2m0 8l2 2-2 2M9 7l2 2-2 2" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-2">No Query Configured</h3>
                  <p className="text-sm text-slate-500 max-w-xs">
                    Build a custom hierarchy or select a saved query to configure visualization
                  </p>
                </div>
              </div>
            )}

            {/* Generated Flux Query - pinned to bottom right */}
            {showFluxInWorkbench && hierarchyFluxText && (
              <div className="mt-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">Flux Query</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyFlux}
                      className="text-xs bg-white/70 hover:bg-white border border-slate-200/50 hover:border-slate-300 text-slate-700 px-2 py-1 rounded-md transition-all duration-200"
                    >
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => setShowFluxInWorkbench(false)}
                      className="text-xs text-slate-600 hover:text-slate-800 px-2 py-1 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-50/50 max-h-48 overflow-auto">
                  <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                    {hierarchyFluxText}
                  </pre>
                </div>
              </div>
            )}
            </div>
        </div>
      </div>
    );
  }


  return (
    <div className="p-3 grid grid-cols-12 gap-3 min-h-full">
      <div className="col-span-12">
        <div className="h-10 rounded-xl bg-gradient-to-r from-sky-50 to-transparent border border-dashed border-sky-100 flex items-center px-3 text-sm text-sky-700/80">
          {hasQuery ? (
            <>
              <span className="ml-2">
                Showing: {selectedMeasurement}.{selectedField}
                {selectedTags.length > 0 && ` (${selectedTags.length} filters)`}
                <span className="ml-2 text-sky-500">• {range}</span>
              </span>
            </>
          ) : (
            'Select measurement and field to view dashboard'
          )}
        </div>
      </div>

      {hasQuery ? (
        <>
          {/* Main chart - always full width */}
          <div className="col-span-12">
            <GrafanaPanel
              key="explorer-panel"
              measurement={selectedMeasurement}
              selectedField={selectedField}
              selectedTags={selectedTags}
              range={range}
              visualizationType={visualizationType}
              bucketName={bucketName}
              onVisualizationTypeChange={setVisualizationType}
              instanceId="explorer"
            />
          </div>


          {/* Flux query panel - displayed below Dashboard with animation */}
          <div className={`col-span-12 transition-all duration-300 ease-in-out ${
            showFlux ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden'
          }`}>
            {showFlux && (
              <div className="border border-zinc-200 rounded-lg bg-white shadow-sm">
                <div className="flex items-center justify-between p-3 border-b border-zinc-200 bg-gradient-to-r from-slate-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-zinc-800">Flux Query</span>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">Generated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyFlux}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors"
                      title={copySuccess ? "Copied!" : "Copy Flux query"}
                    >
                      {copySuccess ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={onCloseFlux}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-md transition-colors"
                      title="Close Flux panel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Close</span>
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="bg-white rounded border border-zinc-200 p-3">
                    <pre className="text-xs text-zinc-700 font-mono whitespace-pre-wrap leading-relaxed">
                      {fluxText}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Show prompt when no query is configured */}
          <div className="col-span-12 flex items-center justify-center min-h-[300px]">
            <div className="text-center text-zinc-500">
              <h3 className="text-lg font-medium text-zinc-700 mb-2">Ready for Visualization</h3>
              <p className="text-sm max-w-md">
                Select a bucket, measurement, and field from the left panel to start exploring your data with Grafana dashboards.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============ Right Visualization Panel ============ */
function RightVisualizationPanel({ open, onClose, visualizationType, setVisualizationType }) {
  const visualizations = [
    {
      id: 'timeseries',
      name: 'Time series',
      description: 'Time based line, area and bar charts',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 20h18M3 4h18" />
        </svg>
      )
    },
    {
      id: 'barchart',
      name: 'Bar chart',
      description: 'Categorical charts with group support',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="12" width="3" height="8" />
          <rect x="7" y="8" width="3" height="12" />
          <rect x="11" y="6" width="3" height="14" />
          <rect x="15" y="10" width="3" height="10" />
          <rect x="19" y="4" width="3" height="16" />
        </svg>
      )
    },
    {
      id: 'stat',
      name: 'Stat',
      description: 'Big stat values & sparklines',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l3-3 3 3v13M9 9h6" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
          <circle cx="17" cy="17" r="1" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'gauge',
      name: 'Gauge',
      description: 'Standard gauge visualization',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
          <circle cx="12" cy="12" r="6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'table',
      name: 'Table',
      description: 'Supports many column styles',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      )
    },
    {
      id: 'piechart',
      name: 'Pie chart',
      description: 'The new core pie chart visualization',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2v8l6.928 4A8 8 0 1112 4z" />
          <path d="M12 4a8 8 0 016.928 12L12 12V4z" fill="currentColor" fillOpacity="0.6" />
        </svg>
      )
    },
    {
      id: 'heatmap',
      name: 'Heatmap',
      description: 'Like a histogram over time',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="2" width="4" height="4" fillOpacity="0.3" />
          <rect x="6" y="2" width="4" height="4" fillOpacity="0.6" />
          <rect x="10" y="2" width="4" height="4" fillOpacity="0.9" />
          <rect x="14" y="2" width="4" height="4" fillOpacity="0.4" />
          <rect x="18" y="2" width="4" height="4" fillOpacity="0.7" />
          <rect x="2" y="6" width="4" height="4" fillOpacity="0.8" />
          <rect x="6" y="6" width="4" height="4" fillOpacity="0.2" />
          <rect x="10" y="6" width="4" height="4" fillOpacity="0.5" />
          <rect x="14" y="6" width="4" height="4" fillOpacity="1" />
          <rect x="18" y="6" width="4" height="4" fillOpacity="0.3" />
          <rect x="2" y="10" width="4" height="4" fillOpacity="0.6" />
          <rect x="6" y="10" width="4" height="4" fillOpacity="0.9" />
          <rect x="10" y="10" width="4" height="4" fillOpacity="0.2" />
          <rect x="14" y="10" width="4" height="4" fillOpacity="0.7" />
          <rect x="18" y="10" width="4" height="4" fillOpacity="0.8" />
        </svg>
      )
    },
    {
      id: 'histogram',
      name: 'Histogram',
      description: 'Bucketized value distribution',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="16" width="2" height="6" />
          <rect x="5" y="12" width="2" height="10" />
          <rect x="8" y="8" width="2" height="14" />
          <rect x="11" y="10" width="2" height="12" />
          <rect x="14" y="6" width="2" height="16" />
          <rect x="17" y="14" width="2" height="8" />
          <rect x="20" y="18" width="2" height="4" />
        </svg>
      )
    }
  ];

  if (!open) return null;

  return (
    <div className="fixed right-0 top-14 bottom-0 w-80 border-l border-zinc-200 bg-white z-20 shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="m-0 font-medium text-zinc-800">Visualizations</h3>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          ×
        </button>
      </div>



      {/* Visualization Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-2">
          {visualizations.map((viz) => (
            <button
              key={viz.id}
              onClick={() => setVisualizationType(viz.id)}
              className={`w-full p-3 rounded-lg border-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-all ${
                visualizationType === viz.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                  {viz.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 text-sm mb-1">{viz.name}</div>
                  <div className="text-xs text-zinc-500 leading-tight">{viz.description}</div>
                </div>
                {visualizationType === viz.id && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Flux Drawer (> symbol safe display) ============ */
function FluxDrawer({ open, onClose, flux }) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 h-60 bg-white border-t border-zinc-200 shadow-2xl z-30 flex flex-col">
      <div className="h-11 px-3 border-b border-zinc-200 flex items-center justify-between">
        <strong>Flux</strong>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(flux || '')}
            className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-zinc-50">
        <pre className="m-0 p-3 text-sm text-zinc-800">
          <code>{flux}</code>
        </pre>
      </div>
    </div>
  );
}

/* ============ Login Modal (/auth/login) ============ */
function LoginModal({ open, onClose, onSuccess, setStatus }) {
  const [url, setUrl] = useState('http://influxdb:8086');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40">
      <div className="w-[480px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            {/* InfluxDB Logo - Polygon */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-neutral-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" stroke="#4A90E2" strokeWidth="1.5" fill="none"/>
                  <path d="M12 2l8 4.5L12 11 4 6.5 12 2z" fill="#4A90E2" opacity="0.3"/>
                  <path d="M4 6.5v11L12 22l8-4.5v-11" stroke="#4A90E2" strokeWidth="1.5" fill="none"/>
                  <path d="M12 11v11" stroke="#4A90E2" strokeWidth="1.5"/>
                  <path d="M4 6.5L12 11l8-4.5" stroke="#4A90E2" strokeWidth="1.5"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-neutral-700">InfluxDB</span>
            </div>

            <div className="text-neutral-300">+</div>

            {/* Grafana Logo - Gear */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-neutral-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" fill="#F46800"/>
                  <path d="M12 1l2.09 6.26L20 5.73l-1.27 6.41L24 12l-5.27.86L20 19.27l-5.91-1.53L12 24l-2.09-6.26L4 19.27l1.27-6.41L0 12l5.27-.86L4 4.73l5.91 1.53L12 1z" fill="#F46800" opacity="0.6"/>
                  <circle cx="12" cy="12" r="2" fill="#FFF"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-neutral-700">Grafana</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-1">Connect to InfluxDB and Grafana</h2>
          <p className="text-neutral-600 text-sm">Enter your InfluxDB credentials to get started</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              InfluxDB URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
              </div>
              <input
                value={url}
                onChange={e=>setUrl(e.target.value)}
                placeholder="http://influxdb:8086"
                className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Access Token
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2v6m0 0a2 2 0 01-2 2m2-2a2 2 0 002 2M9 5a2 2 0 00-2 2v6a2 2 0 002 2m0 0a2 2 0 002 2m-2-2v6m0 0a2 2 0 01-2 2" />
                </svg>
              </div>
              <input
                type="password"
                value={token}
                onChange={e=>setToken(e.target.value)}
                placeholder="Your InfluxDB token"
                className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                setStatus('Logging in...');
                const j = await loginApi(url, token);
                if (j?.ok) {
                  setStatus('Login OK');
                  onSuccess?.();
                } else {
                  setStatus('Login failed: ' + (j?.error || 'Unknown error'));
                }
              } catch (e) {
                setStatus('Login error: ' + e.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !url || !token}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-sky-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-xs text-neutral-500">
            Your session is securely stored in the browser until you logout
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ App: State + API Integration + Tailwind Layout ============ */
export default function App() {
  // Layout controls
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [fluxOpen, setFluxOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(true);
  const [activeModule, setActiveModule] = useState('query'); // 'query', 'hierarchy', or 'hierarchyQuery'
  const [showFluxInWorkbench, setShowFluxInWorkbench] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(376); // Initial width: 14(nav) + 320(content) + 2px borders = 336
  const [isDragging, setIsDragging] = useState(false);

  // Dark mode state
  // Handle drag to resize panel width
  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newWidth = Math.min(Math.max(280, e.clientX), window.innerWidth * 0.6);
    setLeftPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Dark mode effect - apply class name to document root element and persist
  // Login & status
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState('');

  // Data sources & selections
  const [buckets, setBuckets] = useState([]);
  const [activeBucketId, setActiveBucketId] = useState(null);
  const [globalTreeData, setGlobalTreeData] = useState([]);

  const [measurements, setMeasurements] = useState([]);
  const [selectedMeasurement, setSelectedMeasurement] = useState('');

  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState('');

  const [tagKeys, setTagKeys] = useState([]);
  // Changed to array structure, each element contains {key, values, allValues}
  const [selectedTags, setSelectedTags] = useState([]);

  const [groupBy, setGroupBy] = useState([]);

  const [range, setRange] = useState('-1h');
  const [visualizationType, setVisualizationType] = useState('timeseries');
  const [aggregateFunction, setAggregateFunction] = useState('mean');
  const [fluxText, setFluxText] = useState('');

  // Tree module drag state
  const [droppedItems, setDroppedItems] = useState([]);
  const [customHierarchy, setCustomHierarchy] = useState([]);
  const [selectedHierarchyNode, setSelectedHierarchyNode] = useState(null);
  const [hierarchyFluxText, setHierarchyFluxText] = useState('');
  const [hierarchyVisualizationType, setHierarchyVisualizationType] = useState('timeseries');

  // Hierarchy Query module state
  const [savedHierarchyDefinition, setSavedHierarchyDefinition] = useState(null);
  const [hierarchyQuerySelection, setHierarchyQuerySelection] = useState({});
  const [activeHierarchyTab, setActiveHierarchyTab] = useState('live');
  const [isCustomHierarchyCollapsed, setIsCustomHierarchyCollapsed] = useState(false);
  const [isSavedHierarchyCollapsed, setIsSavedHierarchyCollapsed] = useState(true);

  // Load saved hierarchy definitions
  useEffect(() => {
    const saved = localStorage.getItem('savedHierarchyDefinition');
    console.log('Loading saved hierarchy from localStorage:', saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Successfully parsed saved hierarchy:', parsed);
        setSavedHierarchyDefinition(parsed);
        // Only auto-expand when parsed is a valid non-empty array
        if (Array.isArray(parsed) && parsed.length > 0) {
          setIsSavedHierarchyCollapsed(false);
          console.log('Auto-expanding saved hierarchy section (valid data found)');
        }
      } catch (e) {
        console.error('Failed to parse saved hierarchy definition:', e);
        // If parsing fails, clear corrupted data
        localStorage.removeItem('savedHierarchyDefinition');
      }
    } else {
      console.log('No saved hierarchy found in localStorage');
    }
  }, []);

  // Loading state
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  // Current bucket name (used for Flux)
  const activeBucket = useMemo(
    () => buckets.find(b => b.id === activeBucketId) || null,
    [buckets, activeBucketId]
  );
  const activeBucketName = activeBucket?.name || '';

  // Login success -> auto fetch buckets
  useEffect(() => {
    const loadBuckets = async () => {
      try {
        setLoadingBuckets(true);
        setStatus('Loading buckets...');
        const list = await fetchBuckets();
        setBuckets(list);
        setStatus(`Loaded ${list.length} buckets`);
      } catch (e) {
        setStatus('Load buckets error: ' + e.message);
        setBuckets([]);
      } finally {
        setLoadingBuckets(false);
      }
    };
    if (loggedIn) loadBuckets();
  }, [loggedIn]);

  // Switch bucket -> clear downstream + fetch measurements
  useEffect(() => {
    if (!activeBucketId) {
      setMeasurements([]); setSelectedMeasurement('');
      setFields([]); setSelectedField('');
      return;
    }
    const run = async () => {
      try {
        setLoadingMeasurements(true);
        setStatus(`Loading measurements for bucketId=${activeBucketId}...`);
        const list = await fetchMeasurements(activeBucketId);
        setMeasurements(list);
        setStatus(`Loaded ${list.length} measurements`);
      } catch (e) {
        setMeasurements([]);
        setStatus('Load measurements error: ' + e.message);
      } finally {
        setLoadingMeasurements(false);
      }
    };
    setMeasurements([]); setSelectedMeasurement('');
    setFields([]); setSelectedField('');
    run();
  }, [activeBucketId]);

  // Switch measurement -> clear field + fetch fields
  useEffect(() => {
    if (!selectedMeasurement || !activeBucketId) {
      setFields([]); setSelectedField('');
      return;
    }
    const run = async () => {
      try {
        setLoadingFields(true);
        setStatus(`Loading fields for "${selectedMeasurement}"...`);
        const list = await fetchFields(activeBucketId, selectedMeasurement);
        setFields(list);
        setStatus(`Loaded ${list.length} fields`);
      } catch (e) {
        setFields([]);
        setStatus('Load fields error: ' + e.message);
      } finally {
        setLoadingFields(false);
      }
    };
    setFields([]); setSelectedField('');
    run();
  }, [selectedMeasurement, activeBucketId]);
  
  // Fetch available tag keys after measurement changes
  useEffect(() => {
    setTagKeys([]); setSelectedTags([]);
    if (!selectedMeasurement || !activeBucketId) return;
    fetchTagKeys(activeBucketId, selectedMeasurement)
      .then(setTagKeys)
      .catch(e => setStatus('Load tag keys error: ' + e.message));
  }, [selectedMeasurement, activeBucketId]);

  // Build group options when measurement changes
  const groupOptions = useMemo(() => {
    const BASE = ['_measurement','_field'];
    const BLOCK = new Set(['_time','_start','_stop']); // BASE not included in BLOCK
    const raw = [...BASE, ...(tagKeys || [])].filter(Boolean).filter(k => !BLOCK.has(k));
    return Array.from(new Set(raw));   // Deduplicate, ensure _measurement/_field appears only once
  }, [tagKeys]);


  useEffect(() => {
    setGroupBy([]); // Default no group selected, let the user choose
  }, [selectedMeasurement]);

  // Auto run: automatically build Flux when conditions are complete (can trigger chart refresh later)
  useEffect(() => {
    const ready = activeBucketName && selectedMeasurement && selectedField;
    if (ready) {
      try {
        // Convert selectedTags to the format expected by backend
        const tags = selectedTags
          .filter(tag => tag.values.length > 0)
          .map(tag => ({
            key: tag.key,
            op: 'in',
            value: tag.values
          }));

        // Build query spec (not used currently, but kept for future needs)
        buildQuerySpecFromUI({
          measurement: selectedMeasurement,
          field: selectedField,
          tags,
          range,
          groupBy: groupBy.length > 0 ? groupBy : [], // Only pass group when user has selected
          aggregate: { every: getAggregateWindow(range), fn: 'mean' }
        });

        // Simplified Flux query builder (for display)
        let simpleFlux = `from(bucket: "${activeBucketName}")
  |> range(start: ${range})
  |> filter(fn: (r) => r._measurement == "${selectedMeasurement}")
  |> filter(fn: (r) => r._field == "${selectedField}")`;

        // Add tag filters - each tag filtered independently
        if (tags.length > 0) {
          tags.forEach(tag => {
            // Note: In InfluxDB, tag values are always strings, even if they look like numbers they need quotes
            const values = tag.value; // The tags array uses the value field, not values
            if (values.length === 1) {
              // Single value: direct comparison, tag value must be quoted
              const value = values[0];
              simpleFlux += `\n  |> filter(fn: (r) => r["${tag.key}"] == "${value}")`;
            } else {
              // Multiple values: use contains, tag values must be quoted
              simpleFlux += `\n  |> filter(fn: (r) => contains(value: r["${tag.key}"], set: [${values.map(v => `"${v}"`).join(', ')}]))`;
            }
          });
        }

        // Add aggregation - dynamically adjust aggregate window based on time range
        const dynamicWindow = getAggregateWindow(range);
        simpleFlux += `\n  |> aggregateWindow(every: ${dynamicWindow}, fn: ${aggregateFunction}, createEmpty: false)`;

        // Add group by (only group when user manually selects)
        if (groupBy.length > 0) {
          simpleFlux += `\n  |> group(columns: [${groupBy.map(col => `"${col}"`).join(', ')}], mode: "by")`;
        }

        simpleFlux += `\n  |> yield(name: "mean")`;

        setFluxText(simpleFlux);
      } catch (e) {
        console.error('Error building flux query:', e);
      }
    } else {
      setFluxText('');
    }
  }, [activeBucketName, selectedMeasurement, selectedField, selectedTags, range, groupBy]);

  // Tree module drag handler functions
  const handleDragStart = (e, node) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (nodeData) => {
    // Avoid adding duplicate items
    const exists = droppedItems.some(item => item.id === nodeData.id);
    if (!exists) {
      setDroppedItems(prev => [...prev, nodeData]);
    }
  };

  const handleRemoveItem = (index) => {
    setDroppedItems(prev => prev.filter((_, i) => i !== index));
  };

  // Click Run/Apply: build Flux and open drawer
  const runNow = async () => {
    if (!activeBucketId || !selectedMeasurement || !selectedField) {
      setStatus('Please complete bucket/measurement/field.');
      return;
    }
    try {
      setStatus('Running query...');
      // Convert selectedTags to the format expected by backend
      const tags = selectedTags
        .filter(tag => tag.values.length > 0)
        .map(tag => ({
          key: tag.key,
          op: 'in',
          value: tag.values
        }));

      const spec = buildQuerySpecFromUI({
        measurement: selectedMeasurement,
        field: selectedField,
        tags,
        range,
        groupBy: groupBy.length > 0 ? groupBy : [], // Only pass group when user has selected
        aggregate: { every: getAggregateWindow(range), fn: 'mean' }  // Dynamically adjust aggregate window
      });
      const { flux, rows } = await runQuerySpec({ bucketId: activeBucketId, spec });
      setFluxText(sanitizeFlux(flux));
      // TODO: The rows here can be passed to chart/Grafana (not displayed for now)
      setStatus(`Query returned ${Array.isArray(rows) ? rows.length : 0} rows`);
    } catch (e) {
      setStatus('Run error: ' + e.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <Topbar
        loggedIn={loggedIn}
        onLoginOpen={() => setLoginOpen(true)}
        onLogout={async () => {
          await logoutApi();
          setLoggedIn(false);
          setBuckets([]); setActiveBucketId(null);
          setMeasurements([]); setSelectedMeasurement('');
          setFields([]); setSelectedField('');
          setSelectedTags([]);
          setStatus('Logged out');
        }}
      />

      <main className="flex-1 flex overflow-hidden">
        {/* Navigation sidebar - always visible */}
        <nav className="w-14 bg-zinc-100 border-r border-zinc-200 flex flex-col flex-shrink-0">
              <div className="p-3">
                <button
                  onClick={() => setLeftOpen(!leftOpen)}
                  className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center hover:bg-sky-600 transition-colors"
                  title={leftOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {leftOpen ? (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex-1 py-4">
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveModule('query');
                      setLeftOpen(true);
                    }}
                    className={`w-full p-3 flex flex-col items-center text-xs ${
                      activeModule === 'query'
                        ? 'text-sky-600 bg-sky-50 border-r-2 border-sky-500'
                        : 'text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50'
                    }`}
                    title="Data Explorer"
                  >
                    <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Query</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveModule('hierarchy');
                      setLeftOpen(true);
                    }}
                    className={`w-full p-3 flex flex-col items-center text-xs ${
                      activeModule === 'hierarchy'
                        ? 'text-sky-600 bg-sky-50 border-r-2 border-sky-500'
                        : 'text-zinc-600 hover:text-zinc-800 hover:bg-zinc-50'
                    }`}
                    title="Custom Hierarchy"
                  >
                    <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4l-4 4 4 4M5 7l4 4-4 4" />
                    </svg>
                    <span>Tree</span>
                  </button>

                </div>
              </div>
        </nav>

        {/* Left panel content - collapsible */}
        {leftOpen && (
          <div
            className="flex flex-col bg-white border-r border-zinc-200 flex-shrink-0"
            style={{ width: `${leftPanelWidth - 56}px` }}
          >
            {/* Module content area - independent scrolling */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {activeModule === 'query' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-200 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">Data Explorer</h2>
                    <button
                      onClick={() => setLeftOpen(false)}
                      className="p-1 rounded-md hover:bg-zinc-100"
                      title="Collapse sidebar"
                    >
                      <svg className="w-4 h-4 text-slate-600" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Time Range selector */}
                    <div className="flex justify-end px-4 py-3 bg-gray-50/30 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-600 whitespace-nowrap">Time Range</label>
                        <div className="min-w-[140px]">
                          <CustomDropdown
                            value={range}
                            onChange={(value) => setRange(value)}
                            options={[
                              { value: "-5m", label: "Last 5 minutes" },
                              { value: "-15m", label: "Last 15 minutes" },
                              { value: "-30m", label: "Last 30 minutes" },
                              { value: "-1h", label: "Last 1 hour" },
                              { value: "-3h", label: "Last 3 hours" },
                              { value: "-6h", label: "Last 6 hours" },
                              { value: "-12h", label: "Last 12 hours" },
                              { value: "-24h", label: "Last 24 hours" },
                              { value: "-2d", label: "Last 2 days" },
                              { value: "-3d", label: "Last 3 days" },
                              { value: "-7d", label: "Last 7 days" },
                              { value: "-14d", label: "Last 14 days" },
                              { value: "-30d", label: "Last 30 days" },
                              { value: "-60d", label: "Last 60 days" },
                              { value: "-90d", label: "Last 90 days" },
                              { value: "-180d", label: "Last 180 days" },
                              { value: "-365d", label: "Last 365 days" }
                            ]}
                            placeholder="Select time range"
                            colorTheme="gray"
                            fontSize="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <LeftQueryBuilder
                      buckets={buckets}
                      activeBucketId={activeBucketId}
                      setActiveBucketId={setActiveBucketId}
                      measurements={measurements}
                      selectedMeasurement={selectedMeasurement}
                      setSelectedMeasurement={setSelectedMeasurement}
                      fields={fields}
                      selectedField={selectedField}
                      setSelectedField={setSelectedField}
                      range={range}
                      setRange={setRange}
                      onApply={runNow}
                      tagKeys={tagKeys}
                      selectedTags={selectedTags}
                      setSelectedTags={setSelectedTags}
                      setStatus={setStatus}
                      groupOptions={groupOptions}
                      groupBy={groupBy}
                      setGroupBy={setGroupBy}
                      loadingBuckets={loadingBuckets}
                      loadingMeasurements={loadingMeasurements}
                      loadingFields={loadingFields}
                      visualizationType={visualizationType}
                      setVisualizationType={setVisualizationType}
                      aggregateFunction={aggregateFunction}
                      setAggregateFunction={setAggregateFunction}
                      isEmbedded={true}
                      onShowFlux={() => setShowFluxInWorkbench(true)}
                      showFluxInWorkbench={showFluxInWorkbench}
                      setShowFluxInWorkbench={setShowFluxInWorkbench}
                    />
                  </div>
                </div>
              )}

              {activeModule === 'hierarchy' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-200 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">Data Organization</h2>
                    <button
                      onClick={() => setLeftOpen(false)}
                      className="p-1 rounded-md hover:bg-zinc-100"
                      title="Collapse sidebar"
                    >
                      <svg className="w-4 h-4 text-slate-600" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-4">
                      <DataTree
                        buckets={buckets}
                        onDragStart={handleDragStart}
                        onTreeDataUpdate={setGlobalTreeData}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drag resizer */}
        {leftOpen && (
          <div
            className={`w-1 bg-zinc-200 hover:bg-sky-400 cursor-col-resize flex-shrink-0 transition-all duration-200 relative group ${
              isDragging ? 'bg-sky-500 w-2' : ''
            }`}
            onMouseDown={handleMouseDown}
            title="Drag to resize panel"
          >
            {/* Drag handle indicator */}
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <div className="flex flex-col space-y-0.5">
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {/* Main workspace - independent scrolling */}
        <section className="flex-1 flex flex-col overflow-hidden relative">


          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <Workbench
              selectedMeasurement={selectedMeasurement}
              selectedField={selectedField}
              selectedTags={selectedTags}
              range={range}
              visualizationType={visualizationType}
              setVisualizationType={setVisualizationType}
              bucketName={activeBucketName}
              showFlux={showFluxInWorkbench}
              fluxText={fluxText}
              onCloseFlux={() => setShowFluxInWorkbench(false)}
              activeModule={activeModule}
              customHierarchy={customHierarchy}
              onUpdateHierarchy={setCustomHierarchy}
              treeData={globalTreeData}
              buckets={buckets}
              selectedHierarchyNode={selectedHierarchyNode}
              setSelectedHierarchyNode={setSelectedHierarchyNode}
              hierarchyFluxText={hierarchyFluxText}
              setHierarchyFluxText={setHierarchyFluxText}
              hierarchyVisualizationType={hierarchyVisualizationType}
              setHierarchyVisualizationType={setHierarchyVisualizationType}
              showFluxInWorkbench={showFluxInWorkbench}
              setShowFluxInWorkbench={setShowFluxInWorkbench}
              savedHierarchyDefinition={savedHierarchyDefinition}
              setSavedHierarchyDefinition={setSavedHierarchyDefinition}
              hierarchyQuerySelection={hierarchyQuerySelection}
              setHierarchyQuerySelection={setHierarchyQuerySelection}
              activeHierarchyTab={activeHierarchyTab}
              setActiveHierarchyTab={setActiveHierarchyTab}
              isCustomHierarchyCollapsed={isCustomHierarchyCollapsed}
              setIsCustomHierarchyCollapsed={setIsCustomHierarchyCollapsed}
              isSavedHierarchyCollapsed={isSavedHierarchyCollapsed}
              setIsSavedHierarchyCollapsed={setIsSavedHierarchyCollapsed}
            />
          </div>
        </section>
      </main>

      {/* Bottom status bar */}
      <footer className="h-7 flex items-center justify-between px-3 text-xs text-zinc-600 bg-white/80 backdrop-blur border-t border-zinc-200">
        <span>{status}</span>
        <div className="flex gap-2">
          <button onClick={() => setRightOpen(true)} className="inline-flex items-center rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">Tags</button>
        </div>
      </footer>

      {/* Tags Panel */}
      {rightOpen && (
        <div className="fixed right-0 top-14 bottom-0 w-80 border-l border-zinc-200 bg-white z-20 p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="m-0 font-medium text-zinc-800">Tags</h3>
            <button onClick={() => setRightOpen(false)} className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Close</button>
          </div>
          <div className="mt-3 text-sm text-zinc-500">
            Tag functionality coming soon...
          </div>
        </div>
      )}


      <FluxDrawer open={fluxOpen} onClose={() => setFluxOpen(false)} flux={fluxText} />

      <LoginModal
        open={loginOpen && !loggedIn}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => { setLoggedIn(true); setLoginOpen(false); }}
        setStatus={setStatus}
      />
    </div>
  );
}
