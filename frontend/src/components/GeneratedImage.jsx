export default function GeneratedImage({ imageUrl, isLoading, altText }) {
  return (
    <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-violet-400/30 bg-violet-500/[0.06] shadow-inner shadow-black/20">
      {imageUrl && !isLoading && (
        <img src={imageUrl} alt={altText} className="h-full w-full animate-rise object-contain" />
      )}
      {isLoading && (
        <>
          <div className="z-10 flex flex-col items-center gap-2 text-sm text-violet-200">
            <span className="animate-float text-3xl">🎨</span>
            Generating your image…
          </div>
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </>
      )}
      {!imageUrl && !isLoading && <span className="text-xs text-slate-500">No image generated yet</span>}
    </div>
  )
}
