import { Spinner } from './PageInput.jsx'

export default function PublishBar({ onPublish, isPublishing, total, selectedCount, disabled }) {
  const pending = total - selectedCount

  return (
    <div className="pointer-events-none sticky bottom-5 z-10 flex justify-center px-4">
      <div className="glass pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl bg-midnight/80 p-2 pl-6 shadow-2xl shadow-black/50 sm:rounded-full">
        <div className="text-sm">
          <span className="font-semibold text-ghost">
            {selectedCount} of {total} components selected
          </span>
          <span className="block text-[11px] text-slate-400 sm:inline sm:before:mx-2 sm:before:content-['·']">
            {disabled
              ? 'Generating fresh variants…'
              : pending > 0
                ? `${pending} without a selection will keep current content`
                : 'Everything is picked'}
          </span>
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || disabled || selectedCount === 0}
          className="grad-btn flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
        >
          {isPublishing ? <Spinner /> : '🚀'}
          Publish {selectedCount} {selectedCount === 1 ? 'component' : 'components'} to AEM
        </button>
      </div>
    </div>
  )
}
