export function PageHeader({ title, subtitle, description, extra }) {
  const detail = subtitle || description;
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-semibold text-slate-800 md:text-2xl">
          {title}
        </h1>
        {detail ? (
          <p className="mt-1 mb-0 text-sm text-slate-500">{detail}</p>
        ) : null}
      </div>
      {extra ? (
        <div className="flex flex-wrap items-center gap-2">{extra}</div>
      ) : null}
    </div>
  );
}
