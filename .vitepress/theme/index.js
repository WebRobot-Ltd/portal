import DefaultTheme from 'vitepress/theme'
import './custom.css'
import ContactForm from '../components/ContactForm.vue'
import ContactPage from '../components/ContactPage.vue'
import DemoApp from '../components/DemoApp.vue'
import AgenticDemo from '../components/AgenticDemo.vue'
import AgenticStudio from '../components/AgenticStudio.vue'
import ByocModeSelector from '../components/ByocModeSelector.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ContactForm', ContactForm)
    app.component('ContactPage', ContactPage)
    app.component('DemoApp', DemoApp)
    app.component('AgenticDemo', AgenticDemo)
    app.component('AgenticStudio', AgenticStudio)
    app.component('ByocModeSelector', ByocModeSelector)
  }
}

