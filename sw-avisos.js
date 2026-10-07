/* Lembretes do Bobossauro: recebe o aviso do agendador e mostra a notificação. */
self.addEventListener('push', function (evento) {
  var d = {}
  try {
    d = evento.data ? evento.data.json() : {}
  } catch (e) {
    d = { title: 'Bobossauro', body: evento.data ? evento.data.text() : '' }
  }
  var base = self.registration.scope
  evento.waitUntil(
    self.registration.showNotification(d.title || 'Bobossauro', {
      body: d.body || '',
      icon: base + 'icone-192.png',
      badge: base + 'favicon-64.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: base },
    })
  )
})

self.addEventListener('notificationclick', function (evento) {
  evento.notification.close()
  var url = (evento.notification.data && evento.notification.data.url) || self.registration.scope
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        if ('focus' in lista[i]) return lista[i].focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
