import { MatrixAlignmentProtocol } from './_components/MatrixAlignmentProtocol'

export default function MatrixPage() {
    return (
        <div className="max-w-[1100px] mx-auto space-y-6 pb-20 px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 py-4">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                        Matrix Alignment Protocol
                        <span className="text-[10px] font-black text-cyan-400 px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 rounded-full tracking-[0.15em] uppercase">
                            Decision Engine
                        </span>
                    </h1>
                    <p className="text-neutral-500 mt-2 text-sm md:text-base">
                        Multi-timeframe confluence validator. Macro → Micro wave alignment before execution.
                    </p>
                </div>
            </div>

            <MatrixAlignmentProtocol />
        </div>
    )
}
