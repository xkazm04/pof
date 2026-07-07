import { StatusDashboard } from '@/components/status/StatusDashboard';

/** /status — the pipeline health map (swimlanes of step readiness across every catalog pipeline). */
export default function StatusPage() {
  return <StatusDashboard />;
}
