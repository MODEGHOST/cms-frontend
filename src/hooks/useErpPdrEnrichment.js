import { useEffect, useRef } from "react";
import { erpApi } from "../services/api";
import {
  COMPLAINT_ERP_FIELDS,
  REJECT_ERP_FIELDS,
  mergeErpIntoRecord,
} from "../utils/mapErpPdr";

/**
 * ดึง ERP แบบเบาๆ หลังเลือก record แล้ว — เติมช่องว่างเท่านั้น
 * ถ้า ERP ปิด/ล่ม: เงียบ ไม่กระทบการค้นหา CMS
 */
export function useErpPdrEnrichment({
  selectedRecord,
  setSelectedRecord,
  setRecords,
  kind = "reject",
}) {
  const doneRef = useRef(new Set());
  const fields = kind === "complaint" ? COMPLAINT_ERP_FIELDS : REJECT_ERP_FIELDS;

  useEffect(() => {
    const id = selectedRecord?.id;
    const pdrNo = String(selectedRecord?.pdr_no || "").trim();
    if (!id || selectedRecord?._fromErp || !pdrNo) return;
    if (doneRef.current.has(id)) return;

    let cancelled = false;
    doneRef.current.add(id);

    erpApi
      .getPdr(pdrNo)
      .then((result) => {
        if (cancelled) return;
        if (!result?.enabled || !result?.ok) return;
        const erpRow = result.data?.[0];
        if (!erpRow) return;

        setSelectedRecord((prev) => {
          if (!prev || Number(prev.id) !== Number(id)) return prev;
          const { record, filledKeys } = mergeErpIntoRecord(prev, erpRow, fields);
          if (!filledKeys.length) return prev;

          setRecords?.((rows) =>
            (rows || []).map((row) =>
              Number(row.id) === Number(id) ? record : row,
            ),
          );
          return record;
        });
      })
      .catch(() => {
        // silent — CMS คงทำงานได้โดยไม่ต้องมี ERP
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedRecord?.id,
    selectedRecord?.pdr_no,
    setSelectedRecord,
    setRecords,
    fields,
  ]);
}
