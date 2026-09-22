'use client'

import React, { useMemo } from 'react'

interface RadarDataItem {
  label?: string
  value?: number
  dimension?: string
  score?: number
}

interface RadarChartProps {
  data: RadarDataItem[]
  size?: number
}

const RadarChart: React.FC<RadarChartProps> = ({ data, size = 300 }) => {
  const levels = 4
  const radius = 80

  const angleSlice = useMemo(() => (Math.PI * 2) / data.length, [data.length])

  const getPolygonPoints = (level: number) => {
    const levelRadius = (radius / levels) * level
    return data
      .map((_, i) => {
        const angle = i * angleSlice - Math.PI / 2
        return `${levelRadius * Math.cos(angle)},${levelRadius * Math.sin(angle)}`
      })
      .join(' ')
  }

  const axisPoints = useMemo(() => {
    return data.map((_, i) => {
      const angle = i * angleSlice - Math.PI / 2
      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      }
    })
  }, [data, angleSlice])

  const getLabel = (item: RadarDataItem) => item.label || item.dimension || ''
  const getValue = (item: RadarDataItem) => item.value ?? item.score ?? 0

  const dataPoints = useMemo(() => {
    return data.map((item, i) => {
      const angle = i * angleSlice - Math.PI / 2
      const scoreRadius = (getValue(item) / 100) * radius
      return {
        x: scoreRadius * Math.cos(angle),
        y: scoreRadius * Math.sin(angle)
      }
    })
  }, [data, angleSlice])

  const dataPointsString = useMemo(() => {
    return dataPoints.map((p) => `${p.x},${p.y}`).join(' ')
  }, [dataPoints])

  const labelPoints = useMemo(() => {
    const labelRadius = radius + 20
    return data.map((_, i) => {
      const angle = i * angleSlice - Math.PI / 2
      return {
        x: labelRadius * Math.cos(angle),
        y: labelRadius * Math.sin(angle)
      }
    })
  }, [data, angleSlice])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
        暂无维度数据
      </div>
    )
  }

  return (
    <div className="radar-chart relative w-full h-full flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="-100 -100 200 200"
        className="overflow-visible"
      >
        {/* 网格背景 */}
        <g className="grid-layer">
          {Array.from({ length: levels }, (_, i) => i + 1).map((level) => (
            <polygon
              key={level}
              points={getPolygonPoints(level)}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
              className="transition-all duration-300"
            />
          ))}
          {/* 轴线 */}
          {axisPoints.map((point, index) => (
            <line
              key={`axis-${index}`}
              x1="0"
              y1="0"
              x2={point.x}
              y2={point.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* 数据区域 */}
        <g className="data-layer">
          {/* 数据多边形填充 */}
          <polygon
            points={dataPointsString}
            fill="rgba(79, 70, 229, 0.2)"
            stroke="#4f46e5"
            strokeWidth="2"
            className="drop-shadow-sm transition-all duration-500 ease-out"
          />
          {/* 数据点 */}
          {dataPoints.map((point, index) => (
            <circle
              key={`point-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#4f46e5"
              stroke="white"
              strokeWidth="2"
              className="cursor-pointer transition-all duration-300 hover:r-5"
            >
              <title>
                {getLabel(data[index])}: {getValue(data[index])}
              </title>
            </circle>
          ))}
        </g>

        {/* 标签文字 */}
        <g className="labels-layer">
          {labelPoints.map((label, index) => (
            <g key={`label-group-${index}`}>
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-gray-600 font-medium"
                style={{ fontSize: '10px' }}
              >
                {getLabel(data[index])}
              </text>
              <text
                x={label.x}
                y={label.y + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-primary-600 font-bold"
                style={{ fontSize: '10px', fill: '#16a34a' }}
              >
                {getValue(data[index])}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

export default RadarChart
