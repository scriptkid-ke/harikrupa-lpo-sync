import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui';
import { EntityStatusBadge } from '@/components/StatusBadge';
import { listUsers, updateUserRoleStatus } from '@/services/adminService';
import { useAuth } from '@/hooks/useAuth';
import type { AppRole, EntityStatus, Profile } from '@/types/database';

const ROLE_LABELS: Record<AppRole, string> = { admin: 'Administrator', manager: 'Manager', employee: 'Employee' };

export default function Users() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(u: Profile, role: AppRole) {
    try {
      await updateUserRoleStatus(u.id, role, u.status);
      toast.success(`${u.full_name}'s role updated to ${ROLE_LABELS[role]}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update role');
    }
  }

  async function toggleStatus(u: Profile) {
    const nextStatus: EntityStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUserRoleStatus(u.id, (u as any).roles?.code ?? 'employee', nextStatus);
      toast.success(`${u.full_name} ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage roles and access. New accounts sign up outside this app and default to Employee until promoted here."
      />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentProfile?.id;
                const role = (u as any).roles?.code as AppRole;
                return (
                  <tr key={u.id}>
                    <td className="font-medium text-sm">{u.full_name} {isSelf && <span className="text-xs text-ink-muted">(you)</span>}</td>
                    <td className="text-sm">{u.email}</td>
                    <td>
                      <select
                        className="field-input py-1 text-xs w-auto"
                        value={role}
                        disabled={isSelf}
                        onChange={(e) => changeRole(u, e.target.value as AppRole)}
                      >
                        {(['admin', 'manager', 'employee'] as AppRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td><EntityStatusBadge status={u.status} /></td>
                    <td className="text-right">
                      {!isSelf && (
                        <button className="text-xs font-medium text-kiln-600" onClick={() => toggleStatus(u)}>
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
