<template>
  <form id="contact-form" class="contact-form" @submit.prevent="handleSubmit">
    <div class="form-group">
      <label for="name">Name *</label>
      <input 
        type="text" 
        id="name" 
        name="name" 
        v-model="form.name"
        required 
        placeholder="Your name"
      />
    </div>
    
    <div class="form-group">
      <label for="email">Email *</label>
      <input 
        type="email" 
        id="email" 
        name="email" 
        v-model="form.email"
        required 
        placeholder="your.email@example.com"
      />
    </div>
    
    <div class="form-group">
      <label for="company">Company</label>
      <input 
        type="text" 
        id="company" 
        name="company" 
        v-model="form.company"
        placeholder="Your company"
      />
    </div>
    
    <div class="form-group">
      <label for="subject">Subject *</label>
      <select 
        id="subject" 
        name="subject" 
        v-model="form.subject"
        required
      >
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
      <textarea 
        id="message" 
        name="message" 
        v-model="form.message"
        rows="6" 
        required 
        placeholder="Tell us how we can help..."
      ></textarea>
    </div>
    
    <button type="submit" class="submit-btn" :disabled="submitting">
      <span v-if="!submitting">Send Message</span>
      <span v-else>Sending...</span>
    </button>
    
    <div v-if="submitStatus" class="submit-status" :class="submitStatus.type">
      {{ submitStatus.message }}
    </div>
  </form>
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
  
  // Simulate form submission
  // In production, replace with actual API call
  setTimeout(() => {
    submitting.value = false
    submitStatus.value = {
      type: 'success',
      message: 'Thank you! Your message has been sent. We\'ll get back to you soon.'
    }
    
    // Reset form
    form.value = {
      name: '',
      email: '',
      company: '',
      subject: '',
      message: ''
    }
    
    // Clear status after 5 seconds
    setTimeout(() => {
      submitStatus.value = null
    }, 5000)
  }, 1500)
}
</script>

<style scoped>
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
  transition: border-color 0.3s ease;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #4F46E5;
}

.submit-btn {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
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

