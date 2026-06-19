export function PrivacyPolicyPage() {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm leading-6">
      <h3 className="text-2xl font-semibold text-slate-100">Privacy Policy</h3>
      <p className="text-slate-300">
        We collect limited analytics data only after consent: page views, timestamp, browser/device details, and IP address when
        enabled by configuration. This data is used for service reliability and usage reporting.
      </p>
      <p className="text-slate-300">You can decline tracking at first load. Declining keeps the app functional and no analytics data is sent.</p>
      <p className="text-slate-300">Stored data is retained only for operational reporting and can be removed upon request.</p>
      <p className="text-slate-300">Contact your site administrator for data deletion or consent-related requests.</p>
    </section>
  );
}
