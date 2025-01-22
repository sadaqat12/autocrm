import DashboardLayout from '../../components/DashboardLayout';

export default function AgentDashboard() {
  return (
    <DashboardLayout>
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Agent Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-blue-900 mb-2">Assigned Tickets</h2>
            <p className="text-3xl font-bold text-blue-600">Loading...</p>
          </div>
          <div className="bg-yellow-50 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-yellow-900 mb-2">Open Tickets</h2>
            <p className="text-3xl font-bold text-yellow-600">Loading...</p>
          </div>
          <div className="bg-green-50 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-green-900 mb-2">Resolved Today</h2>
            <p className="text-3xl font-bold text-green-600">Loading...</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 