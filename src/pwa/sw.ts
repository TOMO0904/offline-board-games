/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] }

const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()
clientsClaim()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
    return
  }
  if (event.data?.type !== 'VERIFY_CACHE') return
  event.waitUntil(
    (async () => {
      const missing: string[] = []
      for (const entry of manifest) {
        const url = typeof entry === 'string' ? entry : entry.url
        if (!(await matchPrecache(url))) missing.push(url)
      }
      event.ports[0]?.postMessage({
        ready: manifest.length > 0 && !missing.length,
        assets: manifest.length,
        missing,
      })
    })(),
  )
})
