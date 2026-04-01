import { createContext, useContext, useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import type { PurchaseRepository } from './purchaseRepository'
import { createMockPurchaseRepository } from './mockPurchaseRepository'

const RepoContext = createContext<PurchaseRepository | null>(null)

export function RepositoryProvider(props: PropsWithChildren) {
  const repo = useMemo(() => createMockPurchaseRepository(), [])
  return <RepoContext.Provider value={repo}>{props.children}</RepoContext.Provider>
}

export function usePurchaseRepository() {
  const repo = useContext(RepoContext)
  if (!repo) throw new Error('usePurchaseRepository must be used within <RepositoryProvider>')
  return repo
}

