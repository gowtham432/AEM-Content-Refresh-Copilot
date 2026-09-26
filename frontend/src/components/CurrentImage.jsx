import { useEffect, useState } from 'react'

export default function CurrentImage({ imageUrl, altText }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [imageUrl])

  return (
    <div>
      <div className="grid aspect-video place-items-center overflow-hidden rounded-2xl border border-white/5 bg-black/20">
        {failed || !imageUrl ? (
          <span className="text-xs text-slate-500">Image unavailable</span>
        ) : (
          <img
            src={imageUrl}
            alt={altText}
            onError={() => setFailed(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>
      {altText && <p className="mt-2 text-xs text-slate-500">Alt: {altText}</p>}
    </div>
  )
}
