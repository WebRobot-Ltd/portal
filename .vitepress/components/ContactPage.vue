<template>
  <div>
    <h1>Contact Us</h1>
    <p>Get in touch with the WebRobot team. We'd love to hear from you!</p>

    <div class="contact-container">
      <div class="contact-info">
        <h2>Let's Talk</h2>
        <p>Have questions about WebRobot? Want to discuss a partnership? Need support?</p>
        
        <div class="contact-methods">
          <div class="contact-method">
            <div class="contact-icon">📧</div>
            <h3>Email</h3>
            <p><a href="mailto:contact@webrobot.eu">contact@webrobot.eu</a></p>
          </div>
          
          <div class="contact-method">
            <div class="contact-icon">💬</div>
            <h3>Support</h3>
            <p><a href="mailto:support@webrobot.eu">support@webrobot.eu</a></p>
          </div>
          
          <div class="contact-method">
            <div class="contact-icon">🤝</div>
            <h3>Partnerships</h3>
            <p><a href="mailto:partners@webrobot.eu">partners@webrobot.eu</a></p>
          </div>
        </div>
      </div>

      <div class="contact-form-container">
        <h2>Send us a Message</h2>
        
        <form id="contact-form" class="contact-form" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="name">Name *</label>
            <input type="text" id="name" v-model="form.name" required placeholder="Your name" />
          </div>
          
          <div class="form-group">
            <label for="email">Email *</label>
            <input type="email" id="email" v-model="form.email" required placeholder="your.email@example.com" />
          </div>
          
          <div class="form-group">
            <label for="company">Company</label>
            <input type="text" id="company" v-model="form.company" placeholder="Your company" />
          </div>
          
          <div class="form-group">
            <label for="subject">Subject *</label>
            <select id="subject" v-model="form.subject" required>
              <option value="">Select a subject</option>
              <option value="general">General Inquiry</option>
              <option value="support">Technical Support</option>
              <option value="partnership">Partnership</option>
              <option value="sales">Sales</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="message">Message *</label>
            <textarea id="message" v-model="form.message" rows="6" required placeholder="Tell us how we can help..."></textarea>
          </div>
          
          <button type="submit" class="submit-btn" :disabled="submitting">
            {{ submitting ? 'Sending...' : 'Send Message' }}
          </button>
          
          <div v-if="submitStatus" class="submit-status" :class="submitStatus.type">
            {{ submitStatus.message }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const form = ref({
  name: '',
  email: '',
  company: '',
  subject: '',
  message: ''
})

const submitting = ref(false)
const submitStatus = ref(null)

const handleSubmit = async () => {
  submitting.value = true
  submitStatus.value = null
  
  setTimeout(() => {
    submitting.value = false
    submitStatus.value = {
      type: 'success',
      message: 'Thank you! Your message has been sent. We\'ll get back to you soon.'
    }
    
    form.value = {
      name: '',
      email: '',
      company: '',
      subject: '',
      message: ''
    }
    
    setTimeout(() => {
      submitStatus.value = null
    }, 5000)
  }, 1500)
}
</script>

<style scoped>
.contact-container {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 3rem;
  margin: 2rem 0;
  padding: 1rem;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  background: #F9FAFB;
}

@media (max-width: 768px) {
  .contact-container {
    grid-template-columns: 1fr;
  }
}

.contact-info {
  padding: 1.5rem;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  background: white;
}

.contact-info h2 {
  color: #4F46E5;
  margin-bottom: 1rem;
  margin-top: 0;
  padding-bottom: 1rem;
  border-bottom: 2px solid #E5E7EB;
}

.contact-info p {
  color: #6B7280;
  line-height: 1.6;
}

.contact-methods {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-method {
  padding: 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.contact-method:hover {
  transform: translateX(10px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.contact-method p {
  margin: 0.5rem 0 0 0;
  color: rgba(255, 255, 255, 0.9);
}

.contact-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.contact-method h3 {
  margin: 0.5rem 0;
  color: white;
}

.contact-method a {
  color: white;
  text-decoration: none;
  font-weight: 500;
}

.contact-form-container {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  max-width: 100%;
  border: 2px solid #E5E7EB;
  transition: border-color 0.3s ease;
}

.contact-form-container:hover {
  border-color: #667eea;
}

.contact-form-container h2 {
  color: #4F46E5;
  margin-bottom: 1.5rem;
  margin-top: 0;
}

.contact-form {
  width: 100%;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #E5E7EB;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  font-family: inherit;
  box-sizing: border-box;
  background: white;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  border-width: 3px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.submit-btn {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: 3px solid transparent;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  border-color: rgba(255, 255, 255, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-status {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
}

.submit-status.success {
  background: #D1FAE5;
  color: #065F46;
  border: 2px solid #10B981;
}

.submit-status.error {
  background: #FEE2E2;
  color: #991B1B;
  border: 2px solid #EF4444;
}
</style>

