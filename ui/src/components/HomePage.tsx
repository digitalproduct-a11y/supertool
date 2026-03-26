type ToolId = 'home' | 'fb-post' | 'affiliate-links' | 'article-generator'

interface Tool {
  id: ToolId
  label: string
  description: string
}

const tools: Tool[] = [
  {
    id: 'fb-post',
    label: 'Article to FB Post',
    description: 'Turn any article into a Facebook image and caption',
  },
  {
    id: 'affiliate-links',
    label: 'Shopee Affiliate Links',
    description: 'Upload a file to generate Shopee affiliate links',
  },
  {
    id: 'article-generator',
    label: 'Shopee Article Generator',
    description: 'Write engaging Shopee product articles from links',
  },
]

interface HomePageProps {
  onToolSelect: (id: ToolId) => void
}

export function HomePage({ onToolSelect }: HomePageProps) {
  return (
    <main className="flex-1 pt-20 md:pt-10 px-4 md:px-8 pb-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-neutral-950 tracking-tight">Welcome</h1>
          <p className="text-neutral-500 mt-1 text-sm">Choose a tool to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className="text-left bg-white rounded-2xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] p-6 hover:shadow-[0_4px_32px_rgba(0,0,0,0.12)] transition-shadow group"
            >
              <h2 className="text-base font-semibold text-neutral-950 group-hover:text-neutral-700 transition-colors">
                {tool.label}
              </h2>
              <p className="text-sm text-neutral-500 mt-1">{tool.description}</p>
              <span className="inline-block mt-4 text-xs font-medium text-neutral-950 bg-neutral-100 px-3 py-1 rounded-full group-hover:bg-neutral-200 transition-colors">
                Open →
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
