import DefaultTheme from 'vitepress/theme'
import './custom.css'
import ContactForm from '../components/ContactForm.vue'
import ContactPage from '../components/ContactPage.vue'
import DemoApp from '../components/DemoApp.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ContactForm', ContactForm)
    app.component('ContactPage', ContactPage)
    app.component('DemoApp', DemoApp)
  }
}

