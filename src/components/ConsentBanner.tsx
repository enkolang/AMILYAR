type ConsentBannerProps = {
  onAccept: () => void;
  onDecline: () => void;
  onOpenPrivacy: () => void;
};

export function ConsentBanner({ onAccept, onDecline, onOpenPrivacy }: ConsentBannerProps) {
  return (
    <div className="fixed inset-x-4 bottom-20 z-50 rounded-md border border-slate-700 bg-slate-900 p-4 shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-xl">
      <p className="text-sm text-slate-100">
        We collect minimal analytics (timestamp, browser/device details, visited pages, and IP when enabled) to improve service
        reliability. Data is stored only if you accept.
      </p>
      <button type="button" onClick={onOpenPrivacy} className="mt-2 text-xs text-indigo-300 underline underline-offset-2">
        Read privacy policy
      </button>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="rounded-md border border-indigo-400 bg-indigo-500 px-3 py-2 text-sm font-medium text-white"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
