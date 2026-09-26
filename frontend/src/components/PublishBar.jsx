import { Spinner } from './PageInput.jsx'

export default function PublishBar({ onPublish, isPublishing, componentCount, disabled }) {
  return (
    <div className="pointer-events-none sticky bottom-5 z-10 flex justify-center px-4">
      <div className="glass pointer-events-auto flex items-center gap-4 rounded-full bg-midnight/70 p-2 pl-6 shadow-2xl shadow-black/50">
        <span className="text-sm text-slate-300">
          {disabled ? 'Generating fresh copy…' : 'Ready when you are'}
        </span>
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || disabled || componentCount === 0}
          className="grad-btn flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
        >
          {isPublishing ? <Spinner /> : '🚀'}
          Publish {componentCount} {componentCount === 1 ? 'component' : 'components'} to AEM
        </button>
      </div>
    </div>
  )
}
