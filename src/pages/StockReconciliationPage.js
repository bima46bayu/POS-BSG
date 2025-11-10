// src/pages/StockReconciliationPage.jsx
import React from "react";
import ReconciliationList from "../components/reconciliation/ReconciliationList";
import ReconciliationDetail from "../components/reconciliation/ReconciliationDetail";
import { useParams, useNavigate } from "react-router-dom";

export default function StockReconciliationPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const openDetail  = (rid) => nav(`/inventory/reconciliation/${rid}`, { replace: false });
  const backToList  = () => nav(`/inventory/reconciliation`, { replace: false });

  return (
    <div className="w-full">
      {id ? (
        <ReconciliationDetail id={Number(id)} onBack={backToList} />
      ) : (
        <ReconciliationList onOpenDetail={openDetail} />
      )}
    </div>
  );
}
