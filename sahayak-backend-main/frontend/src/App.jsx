import { useState } from 'react'
import './App.css'

function App() {
  // ==============================
  // AUTH
  // ==============================

  const [isSignedIn, setIsSignedIn] = useState(false)
  const [currentRole, setCurrentRole] = useState('')
  const [showSignUp, setShowSignUp] = useState(false)

  // ==============================
  // SHARED DATA
  // ==============================

  const [request, setRequest] = useState(null)
  const [requestStatus, setRequestStatus] = useState('PENDING')

  const [emergencyLogs, setEmergencyLogs] = useState([])

  const [volunteerStatus, setVolunteerStatus] =
    useState('UNDER_REVIEW')

  const [selectedWard, setSelectedWard] = useState('')

  // ==============================
  // LOGIN
  // ==============================

  const handleSignIn = (role) => {
    setCurrentRole(role)
    setIsSignedIn(true)
  }

  const handleGuest = () => {
    setCurrentRole('Senior Citizen')
    setIsSignedIn(true)
  }

  const handleLogout = () => {
    setIsSignedIn(false)
    setCurrentRole('')
  }

  // ==============================
  // SIGN UP
  // ==============================

  if (showSignUp) {
    return (
      <SignUp
        onBack={() => setShowSignUp(false)}
      />
    )
  }

  // ==============================
  // SIGN IN
  // ==============================

  if (!isSignedIn) {
    return (
      <SignIn
        onSignIn={handleSignIn}
        onGuest={handleGuest}
        onSignUp={() => setShowSignUp(true)}
      />
    )
  }

  // ==============================
  // ROLE SWITCHER
  // ==============================

  const RoleSwitcher = () => (
    <div className="role-bar">
      <div className="role-switcher-group">
        <span style={{ fontSize: '18px' }}>👤</span>
        <label>Active Portal:</label>

        <select
          className="role-select"
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value)}
        >
          <option value="Senior Citizen">Senior Citizen / Public</option>
          <option value="Volunteer">Verified Volunteer</option>
          <option value="Police Admin">Police Command Center (Admin)</option>
          <option value="Ward Agent">Ward Agent</option>
        </select>
      </div>

      <button className="logout-btn" onClick={handleLogout}>
        <span>←</span> Switch Role / Sign Out
      </button>
    </div>
  )

  const renderRoleComponent = () => {
    if (currentRole === 'Senior Citizen') {
      return (
        <SeniorCitizen
          request={request}
          setRequest={setRequest}
          requestStatus={requestStatus}
          setEmergencyLogs={setEmergencyLogs}
        />
      )
    }
    if (currentRole === 'Volunteer') {
      return (
        <Volunteer
          request={request}
          requestStatus={requestStatus}
          setRequestStatus={setRequestStatus}
        />
      )
    }
    if (currentRole === 'Police Admin') {
      return (
        <PoliceAdmin
          volunteerStatus={volunteerStatus}
          setVolunteerStatus={setVolunteerStatus}
          emergencyLogs={emergencyLogs}
        />
      )
    }
    if (currentRole === 'Ward Agent') {
      return (
        <WardAgent
          selectedWard={selectedWard}
          setSelectedWard={setSelectedWard}
          request={request}
          requestStatus={requestStatus}
        />
      )
    }
    return null
  }

  return (
    <div className="app">
      <Header />
      <RoleSwitcher />
      <main className="main-content">
        {renderRoleComponent()}
      </main>
    </div>
  )
}


// ======================================================
// SIGN IN
// ======================================================

function SignIn({
  onSignIn,
  onGuest,
  onSignUp
}) {

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Senior Citizen')
  const [message, setMessage] = useState('')

  const handleLogin = () => {

    if (!username.trim()) {
      setMessage('Please enter your email or username.')
      return
    }

    if (!password.trim()) {
      setMessage('Please enter your password.')
      return
    }

    onSignIn(role)
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <div
          className="action-card"
          style={{
            maxWidth: '500px',
            margin: '50px auto'
          }}
        >

          <h2>Welcome to SAHAYAK</h2>

          <p>
            Community Assistance & Emergency Dispatch
          </p>

          <h3>Sign In</h3>

          <label>Email / Username</label>

          <input
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
            placeholder="Enter email or username"
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder="Enter password"
          />

          <label>Select Role</label>

          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value)
            }
          >

            <option value="Senior Citizen">
              Senior Citizen / Public
            </option>

            <option value="Volunteer">
              Volunteer
            </option>

            <option value="Police Admin">
              Police Admin
            </option>

            <option value="Ward Agent">
              Ward Agent
            </option>

          </select>

          <button
            className="primary-button"
            onClick={handleLogin}
          >
            Sign In
          </button>

          <button
            className="primary-button"
            style={{ marginTop: '12px' }}
            onClick={onGuest}
          >
            Continue as Guest
          </button>

          {message && (
            <p
              style={{
                marginTop: '15px',
                fontWeight: 'bold'
              }}
            >
              {message}
            </p>
          )}

          <p style={{ marginTop: '25px' }}>
            Don't have an account?
          </p>

          <button
            className="back-button"
            onClick={onSignUp}
          >
            Create Account / Sign Up
          </button>

        </div>

      </main>

    </div>
  )
}


// ======================================================
// SIGN UP
// ======================================================

function SignUp({ onBack }) {

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Senior Citizen')
  const [message, setMessage] = useState('')

  const createAccount = () => {

    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setMessage('Please fill all fields.')
      return
    }

    setMessage(
      '✅ Account created successfully. You can now sign in.'
    )
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <div
          className="action-card"
          style={{
            maxWidth: '500px',
            margin: '50px auto'
          }}
        >

          <button
            className="back-button"
            onClick={onBack}
          >
            ← Back to Sign In
          </button>

          <h2>Create Account</h2>

          <label>Full Name</label>

          <input
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Enter full name"
          />

          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            placeholder="Enter email"
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            placeholder="Create password"
          />

          <label>Account Type</label>

          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value)
            }
          >

            <option value="Senior Citizen">
              Senior Citizen / Public
            </option>

            <option value="Volunteer">
              Volunteer
            </option>

            <option value="Police Admin">
              Police Admin
            </option>

          </select>

          <button
            className="primary-button"
            onClick={createAccount}
          >
            Create Account
          </button>

          {message && (
            <p
              style={{
                marginTop: '15px',
                fontWeight: 'bold'
              }}
            >
              {message}
            </p>
          )}

        </div>

      </main>

    </div>
  )
}


// ======================================================
// SENIOR CITIZEN
// ======================================================

function SeniorCitizen({
  request,
  setRequest,
  requestStatus,
  setEmergencyLogs
}) {

  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')

  const [showSOS, setShowSOS] = useState(false)

  const submitRequest = () => {

    if (!category) {
      setMessage('Please select a category.')
      return
    }

    if (!description.trim()) {
      setMessage('Please enter a description.')
      return
    }

    setRequest({
      category,
      description,
      ward: 'Ward 2'
    })

    setMessage(
      '✅ Assistance request submitted successfully!'
    )
  }

  const openSOS = () => {
    setShowSOS(true)
  }

  const confirmSOS = () => {

    const newEmergency = {
      id: Date.now(),
      type: 'Emergency SOS',
      description:
        description ||
        'Senior citizen emergency',
      location: 'Shirva - Mock Location',
      status: 'VOLUNTEERS_NOTIFIED'
    }

    setEmergencyLogs((previousLogs) => [
      ...previousLogs,
      newEmergency
    ])

    setShowSOS(false)

    setMessage(
      '🚨 SOS confirmed! Notifying top 3-4 nearest volunteers in area...'
    )
  }

  const cancelSOS = () => {

    setShowSOS(false)

    setMessage(
      'SOS cancelled. No emergency alert was sent.'
    )
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <h2>Senior Citizen / Public</h2>

        <p>
          Request assistance or send an emergency SOS.
        </p>

        <div className="senior-actions">

          <div className="action-card">

            <h3>Request Assistance</h3>

            <label>Category</label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
            >

              <option value="">
                Select category
              </option>

              <option value="Medical">
                Medical
              </option>

              <option value="Dialysis">
                Dialysis
              </option>

              <option value="Daily Assistance">
                Daily Assistance
              </option>

              <option value="Emergency">
                Emergency
              </option>

            </select>

            <label>Description</label>

            <textarea
              rows="4"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Describe the assistance you need"
            />

            <button
              className="primary-button"
              onClick={submitRequest}
            >
              Submit Request
            </button>

          </div>


          <div className="sos-card">

            <h3>Emergency SOS</h3>

            <p>
              Use SOS for immediate emergency assistance.
            </p>

            <button
              type="button"
              className="sos-button"
              onClick={openSOS}
            >
              🚨 SEND SOS
            </button>

          </div>

        </div>


        {message && (

          <div
            className="action-card"
            style={{
              marginTop: '25px'
            }}
          >

            <p>
              <strong>{message}</strong>
            </p>

          </div>

        )}


        {request && (

          <div
            className="action-card"
            style={{
              marginTop: '25px'
            }}
          >

            <h3>Request Status</h3>

            <p>
              <strong>Category:</strong>{' '}
              {request.category}
            </p>

            <p>
              <strong>Description:</strong>{' '}
              {request.description}
            </p>

            <p>
              <strong>Status:</strong>{' '}
              {requestStatus}
            </p>

          </div>

        )}


        {showSOS && (

          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}
          >

            <div
              className="action-card"
              style={{
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center'
              }}
            >

              <h2>
                🚨 Confirm Emergency
              </h2>

              <p>
                Your SOS alert is ready to be dispatched.
              </p>

              <p>
                Press <strong>1</strong> to Confirm Emergency.
              </p>

              <p>
                Press <strong>2</strong> to Cancel accidental trigger.
              </p>

              <button
                className="sos-button"
                onClick={confirmSOS}
              >
                1 - CONFIRM EMERGENCY
              </button>

              <button
                className="back-button"
                onClick={cancelSOS}
                style={{
                  marginTop: '15px'
                }}
              >
                2 - CANCEL
              </button>

            </div>

          </div>

        )}

      </main>

    </div>
  )
}


// ======================================================
// VOLUNTEER
// ======================================================

function Volunteer({
  request,
  requestStatus,
  setRequestStatus
}) {

  const [message, setMessage] = useState('')

  const acceptRequest = () => {

    if (!request) {
      setMessage(
        'No service request available.'
      )
      return
    }

    setRequestStatus('ACCEPTED')

    setMessage(
      '✅ Request accepted successfully!'
    )
  }

  const rejectRequest = () => {

    setMessage(
      'Request rejected. Another volunteer can handle it.'
    )
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <h2>Volunteer Dashboard</h2>

        <p>
          Volunteer task management and emergency dispatch.
        </p>


        <div className="role-container">

          <div className="role-card">

            <h3>Trust Score</h3>

            <h1>10</h1>

            <progress
              value="10"
              max="100"
            />

          </div>

          <div className="role-card">

            <h3>Completed Tasks</h3>

            <h1>0</h1>

          </div>

          <div className="role-card">

            <h3>Active Assignments</h3>

            <h1>
              {requestStatus === 'ACCEPTED'
                ? '1'
                : '0'}
            </h1>

          </div>

        </div>


        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>Volunteer Profile</h3>

          <p>
            <strong>Verification:</strong>{' '}
            VERIFIED
          </p>

          <p>
            <strong>Badge:</strong>{' '}
            Novice Guardian
          </p>

          <p>
            <strong>Trust Score:</strong>{' '}
            10
          </p>

        </div>


        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>Badges & Achievements</h3>

          <p>
            🛡️ Novice Guardian — Earned
          </p>

          <p>
            🚑 Emergency Responder — Locked
          </p>

          <p>
            ⭐ Community Hero — Locked
          </p>

        </div>


        <div
  className="action-card"
  style={{
    marginTop: '30px'
  }}
>
  <h3>🏆 Volunteer Certificate</h3>

  <p>
    Your Trust Score: <strong>10</strong>
  </p>

  <p>
    🎉 Certificate unlocked!
  </p>

  <button
    className="primary-button"
    onClick={() => {

      const certificateText = `
SAHAYAK
COMMUNITY ASSISTANCE & EMERGENCY DISPATCH

CERTIFICATE OF APPRECIATION

This certificate is proudly presented to

SAHAYAK VOLUNTEER

for participating in community assistance
and emergency response activities.

Badge: Novice Guardian
Trust Score: 10
Status: VERIFIED

Shirva Police Station (PS 03)
SMVITM Bantakal
Code Troopers

Date: ${new Date().toLocaleDateString()}
      `

      const blob = new Blob(
        [certificateText],
        { type: 'text/plain' }
      )

      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')

      link.href = url

      link.download =
        'SAHAYAK_Volunteer_Certificate.txt'

      document.body.appendChild(link)

      link.click()

      document.body.removeChild(link)

      URL.revokeObjectURL(url)

      setMessage(
        '🏆 Certificate downloaded successfully!'
      )
    }}
  >
    🏆 Download Certificate
  </button>

</div>

        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>Emergency Dispatch Queue</h3>

          {request ? (

            <>

              <p>
                <strong>Category:</strong>{' '}
                {request.category}
              </p>

              <p>
                <strong>Description:</strong>{' '}
                {request.description}
              </p>

              <p>
                <strong>Distance:</strong>{' '}
                1.8 km
              </p>

              <p>
                <strong>Location:</strong>{' '}
                Shirva — Mock Location
              </p>

              <p>
                <strong>Status:</strong>{' '}
                {requestStatus}
              </p>


              {requestStatus === 'PENDING' && (

                <>

                  <button
                    className="primary-button"
                    onClick={acceptRequest}
                  >
                    Accept Incident
                  </button>

                  <button
                    className="back-button"
                    onClick={rejectRequest}
                    style={{
                      marginLeft: '10px'
                    }}
                  >
                    Reject Incident
                  </button>

                </>

              )}


              {requestStatus === 'ACCEPTED' && (

                <>

                  <p>
                    <strong>
                      🟢 Incident accepted.
                    </strong>
                  </p>

                  <h3>
                    Resource Request Controls
                  </h3>

                  <button
                    className="sos-button"
                    onClick={() =>
                      setMessage(
                        '🚑 Ambulance request sent.'
                      )
                    }
                  >
                    Request Ambulance
                  </button>

                  <button
                    className="primary-button"
                    onClick={() =>
                      setMessage(
                        '🛡️ Backup request sent.'
                      )
                    }
                    style={{
                      marginTop: '10px'
                    }}
                  >
                    Request Backup
                  </button>

                  <button
                    className="primary-button"
                    onClick={() =>
                      setMessage(
                        '👮 Police Station alerted.'
                      )
                    }
                    style={{
                      marginTop: '10px'
                    }}
                  >
                    Alert Police Station
                  </button>

                </>

              )}

            </>

          ) : (

            <p>
              No active emergency incidents.
            </p>

          )}

          {message && (

            <p
              style={{
                marginTop: '20px',
                fontWeight: 'bold'
              }}
            >
              {message}
            </p>

          )}

        </div>

      </main>

    </div>
  )
}


// ======================================================
// POLICE ADMIN
// ======================================================

function PoliceAdmin({
  volunteerStatus,
  setVolunteerStatus,
  emergencyLogs
}) {

  const [showLogs, setShowLogs] =
    useState(false)

  const [auditLogs, setAuditLogs] =
    useState([
      'System initialized successfully.',
      'Emergency monitoring active.'
    ])

  const verifyVolunteer = () => {

    setVolunteerStatus('VERIFIED')

    setAuditLogs((logs) => [
      ...logs,
      'Police Admin verified volunteer.'
    ])
  }

  const dispatchPolice = () => {

    setAuditLogs((logs) => [
      ...logs,
      'Emergency escalated to Police Unit 3.'
    ])
  }

  const dispatchAmbulance = () => {

    setAuditLogs((logs) => [
      ...logs,
      'Ambulance dispatch requested.'
    ])
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <h2>
          Police Admin Command Center
        </h2>

        <p>
          Emergency monitoring, verification and dispatch.
        </p>


        <div
          className="role-container"
          style={{
            marginTop: '30px'
          }}
        >

          <div className="role-card">

            <h3>
              Volunteer Verification
            </h3>

            <p>
              Registered volunteer
            </p>

            <p>
              <strong>Status:</strong>{' '}
              {volunteerStatus}
            </p>

            {volunteerStatus !== 'VERIFIED' && (

              <button
                className="primary-button"
                onClick={verifyVolunteer}
              >
                Verify Volunteer
              </button>

            )}

            {volunteerStatus === 'VERIFIED' && (

              <p>
                ✅ Volunteer verified successfully.
              </p>

            )}

          </div>


          <div className="role-card">

            <h3>
              Central Incident Monitor
            </h3>

            <p>
              📍 Shirva — Mock Incident Map
            </p>

            <p>
              🔴 Active SOS:
              {' '}
              {emergencyLogs.length}
            </p>

            <p>
              🟢 Nearby Volunteers: 4
            </p>

          </div>

        </div>


        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>
            Emergency Monitoring
          </h3>

          <button
            className="sos-button"
            onClick={() =>
              setShowLogs(!showLogs)
            }
          >
            {showLogs
              ? 'Hide Emergency Logs'
              : 'View Emergency Logs'}
          </button>


          {showLogs && (

            <div
              style={{
                marginTop: '20px'
              }}
            >

              {emergencyLogs.length === 0 ? (

                <p>
                  No emergency logs available.
                </p>

              ) : (

                emergencyLogs.map((log) => (

                  <div
                    key={log.id}
                    className="action-card"
                  >

                    <p>
                      <strong>
                        {log.type}
                      </strong>
                    </p>

                    <p>
                      {log.description}
                    </p>

                    <p>
                      Location:{' '}
                      {log.location ||
                        'Shirva'}
                    </p>

                    <p>
                      Status:{' '}
                      <strong>
                        {log.status}
                      </strong>
                    </p>

                  </div>

                ))

              )}

            </div>

          )}

        </div>


        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>
            Automated / Manual Dispatch
          </h3>

          <p>
            Automatically assigned volunteers:
            <strong> 4</strong>
          </p>

          <button
            className="primary-button"
            onClick={dispatchPolice}
          >
            Dispatch Police Unit
          </button>

          <button
            className="primary-button"
            onClick={dispatchAmbulance}
            style={{
              marginTop: '10px'
            }}
          >
            Dispatch Ambulance
          </button>

        </div>


        <div
          className="action-card"
          style={{
            marginTop: '30px'
          }}
        >

          <h3>
            System Audit & Data Logs
          </h3>

          {auditLogs.map((log, index) => (

            <p key={index}>
              • {log}
            </p>

          ))}

        </div>

      </main>

    </div>
  )
}


// ======================================================
// WARD AGENT
// ======================================================

function WardAgent({
  selectedWard,
  setSelectedWard,
  request,
  requestStatus
}) {

  const [showRequests, setShowRequests] =
    useState(false)

  const viewRequests = () => {

    if (!selectedWard) {
      alert('Please select a ward first.')
      return
    }

    setShowRequests(true)
  }

  return (
    <div className="app">

      <Header />

      <main className="main-content">

        <h2>
          Ward Agent Dashboard
        </h2>

        <p>
          Localized dashboard for the assigned ward.
        </p>


        <div
          className="action-card"
          style={{
            marginTop: '35px'
          }}
        >

          <h3>
            Ward Requests
          </h3>

          <label>
            Ward Number
          </label>

          <select
            value={selectedWard}
            onChange={(e) =>
              setSelectedWard(e.target.value)
            }
          >

            <option value="">
              Select ward
            </option>

            <option value="Ward 1">
              Ward 1
            </option>

            <option value="Ward 2">
              Ward 2
            </option>

            <option value="Ward 3">
              Ward 3
            </option>

            <option value="Ward 4">
              Ward 4
            </option>

            <option value="Ward 5">
              Ward 5
            </option>

          </select>


          <button
            className="primary-button"
            onClick={viewRequests}
          >
            View Requests
          </button>


          {showRequests && (

            <div
              style={{
                marginTop: '25px'
              }}
            >

              <h3>
                Requests for {selectedWard}
              </h3>

              {request ? (

                <div className="action-card">

                  <p>
                    <strong>
                      Category:
                    </strong>{' '}
                    {request.category}
                  </p>

                  <p>
                    <strong>
                      Description:
                    </strong>{' '}
                    {request.description}
                  </p>

                  <p>
                    <strong>
                      Status:
                    </strong>{' '}
                    {requestStatus}
                  </p>

                </div>

              ) : (

                <p>
                  No requests available for this ward.
                </p>

              )}

            </div>

          )}

        </div>

      </main>

    </div>
  )
}


// ======================================================
// HEADER
// ======================================================

function Header() {
  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="emblem-badge">🛡️</div>
        <div className="title-group">
          <h1>SAHAYAK</h1>
          <p>Community Assistance & Emergency Dispatch System</p>
        </div>
      </div>

      <div className="organization">
        <div className="org-badge">
          <span className="live-indicator"></span>
          <span>SYSTEM ACTIVE • ERSS 112 LINKED</span>
        </div>
        <div className="station-info">
          Shirva Police Station (PS 03) | Udupi District
        </div>
      </div>
    </header>
  )
}

export default App