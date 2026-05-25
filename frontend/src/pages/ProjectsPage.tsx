import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import apiClient from '@/services/api';
import type { Project, ProjectCreate } from '@/types/visualization';
import { useAuth } from '@/contexts/AuthContext';
import '../components/browser/RunTable.css';
import './ProjectsPage.css';

type TableStyle = 'notebook' | 'editorial';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isContributor } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tableStyle, setTableStyle] = useState<TableStyle>('notebook');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', search],
    queryFn: () => apiClient.listProjects({
      search: search || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => apiClient.createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const cardClass = tableStyle === 'notebook' ? 'rt-card--notebook' : 'rt-card--editorial';
  const rowClass = tableStyle === 'notebook' ? 'rt-row--notebook' : 'rt-row--editorial';

  return (
    <div className="pp-page">
      {/* Meta bar */}
      <div className="pp-meta-bar">
        <div className="pp-meta-bar__left">
          <span className="t-eyebrow">Projects</span>
          <span className="pp-meta-bar__count">
            <b>{projects.length}</b> total
          </span>
        </div>
        <div className="pp-meta-bar__right">
          <input
            className="pp-search"
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rt-switcher">
            <button
              className={`rt-switcher__btn ${tableStyle === 'notebook' ? 'rt-switcher__btn--active' : ''}`}
              onClick={() => setTableStyle('notebook')}
            >
              Notebook
            </button>
            <button
              className={`rt-switcher__btn ${tableStyle === 'editorial' ? 'rt-switcher__btn--active' : ''}`}
              onClick={() => setTableStyle('editorial')}
            >
              Editorial
            </button>
          </div>
          {isContributor && (
            <button className="pp-btn-new" onClick={() => setCreateOpen(true)}>
              + New project
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className={cardClass}>
          <div className="rt-loading">
            <div className="rt-loading__spinner" />
            Loading projects...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="pp-error">Failed to load projects.</div>
      )}

      {/* Empty state */}
      {!isLoading && !error && projects.length === 0 && (
        <div className="pp-empty">
          <span className="pp-empty__text">No projects found.</span>
          {isContributor && (
            <button className="pp-btn-new" onClick={() => setCreateOpen(true)}>
              + Create your first project
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && projects.length > 0 && (
        <div className={cardClass}>
          <div className="rt-scroll">
            <table className="rt-table">
              <thead>
                <tr>
                  <th className="pp-col-name">Name</th>
                  <th className="pp-col-lead">Lead</th>
                  <th className="pp-col-runs">Runs</th>
                  <th className="pp-col-visibility">Visibility</th>
                  <th className="pp-col-created">Created</th>
                  <th className="pp-col-arrow"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p: Project) => (
                  <tr
                    key={p.id}
                    className={rowClass}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    {/* Name */}
                    <td>
                      {tableStyle === 'notebook' ? (
                        <div>
                          <div className="pp-name-slug">{p.name}</div>
                          {p.description && (
                            <div className="pp-name-summary">{p.description}</div>
                          )}
                        </div>
                      ) : (
                        <div className="rt-name-mono">{p.name}</div>
                      )}
                    </td>

                    {/* Lead */}
                    <td>
                      {p.pi_name ? (
                        <div className="pp-lead">
                          <span className="pp-lead__avatar">
                            {getInitials(p.pi_name)}
                          </span>
                          <span className="pp-lead__name">{p.pi_name}</span>
                        </div>
                      ) : (
                        <span className="pp-lead__name">--</span>
                      )}
                    </td>

                    {/* Runs */}
                    <td>
                      <span className="pp-runs">{p.run_count}</span>
                    </td>

                    {/* Visibility */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`pp-visibility ${p.is_public ? 'pp-visibility--public' : 'pp-visibility--private'}`}>
                        {p.is_public ? (
                          <>
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M2 7h10M7 2c1.5 1.5 2 3 2 5s-.5 3.5-2 5M7 2c-1.5 1.5-2 3-2 5s.5 3.5 2 5" stroke="currentColor" strokeWidth="1" />
                            </svg>
                            Public
                          </>
                        ) : (
                          <>
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                              <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M5 6V4.5a2 2 0 014 0V6" stroke="currentColor" strokeWidth="1.2" />
                            </svg>
                            Private
                          </>
                        )}
                      </span>
                    </td>

                    {/* Created */}
                    <td>
                      <span className="pp-date">{formatDate(p.created_at)}</span>
                    </td>

                    {/* Arrow */}
                    <td>
                      <button
                        className="rt-arrow-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${p.id}`);
                        }}
                        aria-label="View project"
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createMutation.mutateAsync}
      />
    </div>
  );
};
