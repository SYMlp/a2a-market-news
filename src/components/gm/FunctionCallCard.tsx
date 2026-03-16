'use client'

interface Props {
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'executed'
}

const STATUS_STYLES = {
  pending: { border: 'border-amber-300', header: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  executed: { border: 'border-green-300', header: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
}

export default function FunctionCallCard({ name, args, status }: Props) {
  const s = STATUS_STYLES[status]

  return (
    <div className={`mt-3 rounded-xl border overflow-hidden text-xs ${s.border}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${s.header}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'pending' ? 'animate-pulse' : ''}`} />
        <code className="text-gray-500 font-mono">
          {name}()
          {status === 'executed' && <span className="text-green-600 ml-2 font-sans">done</span>}
        </code>
      </div>
      <div className="px-4 py-2.5 bg-white/50 space-y-1.5">
        {Object.entries(args)
          .filter(([k]) => !k.startsWith('_'))
          .map(([key, val]) => (
            <div key={key} className="flex items-center gap-3">
              <code className="text-gray-400 font-mono w-20 shrink-0">{key}</code>
              <span className="text-gray-700 text-sm truncate">
                {typeof val === 'string' ? val : JSON.stringify(val)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
