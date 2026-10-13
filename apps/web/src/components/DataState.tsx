import type { ReactNode } from "react";

export function DataState({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  if (loading) return <div className="state">Loading match data...</div>;
  if (error) return <div className="state error">This information could not be loaded. {error}</div>;
  if (empty) return <div className="state empty">{emptyText || "This information is not available."}</div>;
  return <>{children}</>;
}
