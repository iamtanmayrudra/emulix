import { JobStatusBadge } from "@/components/job-status-badge";
import { MOCK_JOBS } from "@/lib/mock-data";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports and history</h1>
          <p className="text-sm text-muted">Past jobs with their platform, profile, and status.</p>
        </div>
        <button
          type="button"
          disabled
          title="Exports arrive with report storage (Phase 2)"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium opacity-60"
        >
          Export
        </button>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Job history</caption>
          <thead className="border-b border-border text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Job</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Target</th>
              <th scope="col" className="px-4 py-3 font-medium">Profile</th>
              <th scope="col" className="px-4 py-3 font-medium">Started</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MOCK_JOBS.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3 font-mono text-xs">{job.id}</td>
                <td className="px-4 py-3 capitalize">{job.type}</td>
                <td className="px-4 py-3">{job.target}</td>
                <td className="px-4 py-3">{job.profile}</td>
                <td className="px-4 py-3 text-muted">{job.startedAt}</td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={job.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
