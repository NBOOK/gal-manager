import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import vuetify from './vuetify'

const pinia = createPinia()
const app = createApp(App)


app.use(pinia)
app.use(vuetify)
app.mount('#app')
