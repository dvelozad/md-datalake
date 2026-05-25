import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SimulationRun } from '@/types/visualization';
import './RunTable.css';

export type TableStyle = 'notebook' | 'editorial';

interface RunTableProps {
  runs: SimulationRun[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRunSelect?: (runId: number) => void;
  tableStyle?: TableStyle;
}

const METHOD_COLORS: Record<string, string> = {
  ATOMISTIC: '#2f4ea8',
  H_ADRESS: '#7d3cc6',
  COARSE_GRAINED: '#16936a',
  UNITED_ATOM: '#c87005',
  MONTE_CARLO: '#c44a85',
};

const METHOD_LABELS: Record<string, string> = {
  ATOMISTIC: 'Atomistic',
  H_ADRESS: 'H-AdResS',
  COARSE_GRAINED: 'Coarse-Grained',
  UNITED_ATOM: 'United Atom',
  MONTE_CARLO: 'Monte Carlo',
};

function formatLength(ns: number | undefined | null): string {
  if (!ns && ns !== 0) return '--';
  if (ns >= 1000) return `${(ns / 1000).toFixed(1)} \u00B5s`;
  if (ns >= 1) return `${ns.toFixed(1)} ns`;
  return `${(ns * 1000).toFixed(0)} ps`;
}

function formatAtoms(n: number | undefined | null): string {
  if (!n) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function getConditions(run: SimulationRun, style: TableStyle): string {
  if (style === 'notebook') {
    const parts: string[] = [];
    if (run.ensemble) parts.push(run.ensemble);
    if (run.temperature_target) parts.push(`${run.temperature_target} K`);
    if (run.pressure_target) parts.push(`${run.pressure_target} bar`);
    return parts.join(' \u00B7 ');
  }
  // editorial: show composition in conditions
  return run.system?.composition || `${run.system?.n_atoms || 0} atoms`;
}

function getQualityColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

export const RunTable: React.FC<RunTableProps> = ({
  runs,
  isLoading,
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  tableStyle = 'notebook',
}) => {
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const handleRowClick = (run: SimulationRun) => {
    navigate(`/runs/${run.id}`);
  };

  // Pagination page numbers to show
  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const cardClass = tableStyle === 'notebook' ? 'rt-card--notebook' : 'rt-card--editorial';
  const rowClass = tableStyle === 'notebook' ? 'rt-row--notebook' : 'rt-row--editorial';

  return (
    <div className={cardClass}>
      {/* Table scroll area */}
      <div className="rt-scroll">
        {isLoading ? (
          <div className="rt-loading">
            <div className="rt-loading__spinner" />
            Loading runs...
          </div>
        ) : (
          <table className="rt-table">
            <thead>
              <tr>
                <th className="rt-col-name">Name</th>
                <th className="rt-col-cond">Conditions</th>
                <th className="rt-col-type">Type</th>
                <th className="rt-col-length">Length</th>
                <th className="rt-col-atoms">Atoms</th>
                <th className="rt-col-quality">Quality</th>
                <th className="rt-col-arrow"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const method = run.simulation_method || 'ATOMISTIC';
                const methodColor = METHOD_COLORS[method] || METHOD_COLORS.ATOMISTIC;
                const methodLabel = METHOD_LABELS[method] || method;
                const score = run.completeness_score || 0;
                const qualityColor = getQualityColor(score);

                return (
                  <tr
                    key={run.id}
                    className={rowClass}
                    onClick={() => handleRowClick(run)}
                  >
                    {/* Name */}
                    <td>
                      {tableStyle === 'notebook' ? (
                        <div>
                          <div className="rt-name-primary">{run.run_name}</div>
                          <div className="rt-name-secondary">
                            {run.system?.composition || `${run.system?.n_atoms || 0} atoms`}
                          </div>
                        </div>
                      ) : (
                        <div className="rt-name-mono">{run.run_name}</div>
                      )}
                    </td>

                    {/* Conditions */}
                    <td>
                      <span className="rt-cond-text">
                        {getConditions(run, tableStyle)}
                      </span>
                    </td>

                    {/* Type */}
                    <td>
                      <span
                        className="rt-method-tag"
                        style={{ background: methodColor }}
                      >
                        {methodLabel}
                      </span>
                    </td>

                    {/* Length */}
                    <td>
                      <span className="rt-length-text">
                        {formatLength(run.total_time)}
                      </span>
                    </td>

                    {/* Atoms */}
                    <td>
                      <span className="rt-atoms-text">
                        {formatAtoms(run.system?.n_atoms)}
                      </span>
                    </td>

                    {/* Quality */}
                    <td>
                      <div className="rt-quality">
                        <div className="rt-quality-track">
                          <div
                            className={`rt-quality-fill rt-quality-fill--${qualityColor}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="rt-quality-label">{score}</span>
                      </div>
                    </td>

                    {/* Arrow */}
                    <td>
                      <button
                        className="rt-arrow-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/runs/${run.id}`);
                        }}
                        aria-label="View run details"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M5.25 3.5L8.75 7L5.25 10.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="rt-pagination">
        <div className="rt-pagination__info">
          {totalRows > 0
            ? `${page * pageSize + 1}\u2013${Math.min((page + 1) * pageSize, totalRows)} of ${totalRows}`
            : 'No results'}
        </div>

        <div className="rt-pagination__controls">
          <select
            className="rt-pagination__select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>

          <button
            className="rt-pagination__btn"
            disabled={page === 0}
            onClick={() => onPageChange(0)}
            aria-label="First page"
          >
            &#x21E4;
          </button>
          <button
            className="rt-pagination__btn"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            &#x2039;
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              className={`rt-pagination__btn ${p === page ? 'rt-pagination__btn--active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </button>
          ))}

          <button
            className="rt-pagination__btn"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            &#x203A;
          </button>
          <button
            className="rt-pagination__btn"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(totalPages - 1)}
            aria-label="Last page"
          >
            &#x21E5;
          </button>
        </div>
      </div>
    </div>
  );
};
