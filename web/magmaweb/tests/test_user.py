import unittest
import uuid
import datetime
from mock import Mock, patch
from sqlalchemy import create_engine
from pyramid import testing
from pyramid.httpexceptions import HTTPNotFound
from pyramid.security import Allow, Deny, Everyone
from pyramid.security import ALL_PERMISSIONS, Authenticated
from magmaweb import user


def init_user_db():
    engine = create_engine('sqlite:///:memory:')
    user.init_user_db(engine, True, False)


def destroy_user_db():
    user.DBSession.remove()


class TestUUIDType(unittest.TestCase):
    def setUp(self):
        self.uuidtype = user.UUIDType()

    def test_bind_value(self):
        expected = u'37dc6b15-2013-429c-98b7-f058bcf0c274'
        value = uuid.UUID(expected)
        self.assertEqual(self.uuidtype.process_bind_param(value, None),
                         expected)

    def test_bind_none(self):
        self.assertEqual(self.uuidtype.process_bind_param(None, None),
                         None)

    def test_result_value(self):
        value = u'37dc6b15-2013-429c-98b7-f058bcf0c274'
        expected = uuid.UUID(value)
        self.assertEqual(self.uuidtype.process_result_value(value, None),
                         expected)

    def test_result_none(self):
        self.assertEqual(self.uuidtype.process_result_value(None, None),
                         None)

    def test_result_emptystring(self):
        self.assertEqual(self.uuidtype.process_result_value('', None),
                         None)


class TestUser(unittest.TestCase):
    def test_construct(self):
        u = user.User('bob', 'Bob Smith', 'bob@smith.org')
        self.assertEqual(u.userid, 'bob')
        self.assertEqual(u.displayname, 'Bob Smith')
        self.assertEqual(u.email, 'bob@smith.org')

    @patch('bcrypt.hashpw')
    @patch('bcrypt.gensalt')
    def test_construct_with_password(self, salt, hashpw):
        salt.return_value = 'salty'

        u = user.User('bob', 'Bob Smith', 'bob@smith.org', 'mypassword')

        self.assertEqual(u.userid, 'bob')
        self.assertEqual(u.displayname, 'Bob Smith')
        self.assertEqual(u.email, 'bob@smith.org')
        salt.assert_called_with(12)
        hashpw.assert_called_with('mypassword', 'salty')

    def test_validate_password_correct(self):
        u = user.User('bob', 'Bob Smith', 'bob@smith.org', 'mypassword')
        self.assertTrue(u.validate_password('mypassword'))

    def test_validate_password_incorrect(self):
        u = user.User('bob', 'Bob Smith', 'bob@smith.org', 'mypassword')
        self.assertFalse(u.validate_password('otherpassword'))

    def test_repr(self):
        u = user.User('bob', 'Bob Smith', 'bob@smith.org', 'mypassword')
        self.assertEqual(repr(u),
                         "<User('bob', 'Bob Smith', 'bob@smith.org')>")

    def test_by_id(self):
        init_user_db()
        self.session = user.DBSession()
        u = user.User(u'bob', u'Bob Smith', u'bob@smith.org')
        self.session.add(u)

        u2 = user.User.by_id(u'bob')
        self.assertEqual(u, u2)

        destroy_user_db()

    def test_add(self):
        init_user_db()

        u = user.User(u'bob', u'Bob Smith', u'bob@smith.org')
        user.User.add(u)

        session = user.DBSession()
        u2 = session.query(user.User).get('bob')
        self.assertEqual(u, u2)

        destroy_user_db()

    def test_jobs(self):
        init_user_db()
        session = user.DBSession()
        u = user.User(u'bob', u'Bob Smith', u'bob@smith.org')
        session.add(u)
        job_id = uuid.UUID('11111111-1111-1111-1111-111111111111')
        j = user.JobMeta(job_id, u'bob')
        session.add(j)

        u2 = user.User.by_id(u'bob')  # force commit
        self.assertEqual(u2.jobs, [j])

        destroy_user_db()

    def test_generate(self):
        init_user_db()

        u = user.User.generate()

        eu = user.User(u.userid, 'Temporary user', 'example@example.com')
        self.assertEqual(u, eu)

        session = user.DBSession()
        u2 = session.query(user.User).get(u.userid)
        self.assertEqual(u, u2)

        destroy_user_db()

    def test_delete(self):
        init_user_db()

        u = user.User(u'bob', u'Bob Smith', u'bob@smith.org')
        user.User.add(u)

        user.User.delete(u)

        session = user.DBSession()
        u2 = session.query(user.User).get(u'bob')
        self.assertIsNone(u2)

        destroy_user_db()


class TestJobMeta(unittest.TestCase):
    def setUp(self):
        init_user_db()
        self.session = user.DBSession()
        # job must be owned by a user
        self.session.add(user.User(u'bob', u'Bob Smith', u'bob@smith.org'))

    def tearDown(self):
        destroy_user_db()

    @patch('datetime.datetime')
    def test_contruct_minimal(self, mock_dt):
        jid = uuid.UUID('986917b1-66a8-42c2-8f77-00be28793e58')
        created_at = datetime.datetime(2012, 11, 14, 10, 48, 26, 504478)
        mock_dt.utcnow.return_value = created_at

        j = user.JobMeta(jid, u'bob')

        self.assertEqual(j.jobid, jid)
        self.assertEqual(j.owner, u'bob')
        self.assertEqual(j.description, u'')
        self.assertEqual(j.ms_filename, u'')
        self.assertIsNone(j.parentjobid)
        self.assertEqual(j.state, u'STOPPED')
        self.assertEqual(j.created_at, created_at)
        self.assertEqual(j.launcher_url, u'')

    def test_contstruct(self):
        jid = uuid.UUID('986917b1-66a8-42c2-8f77-00be28793e58')
        pid = uuid.UUID('83198655-b287-427f-af0d-c6bc1ca566d8')
        created_at = datetime.datetime(2012, 11, 14, 10, 48, 26, 504478)
        url = u'http://localhost:9998/job/70a00fe2-f698-41ed-b28c-b37c22f10440'

        j = user.JobMeta(jid, u'bob', description=u'My desc',
                         parentjobid=pid, state=u'RUNNING',
                         ms_filename=u'F00346.mzxml',
                         created_at=created_at,
                         launcher_url=url,
                         )

        self.assertEqual(j.jobid, jid)
        self.assertEqual(j.owner, u'bob')
        self.assertEqual(j.description, u'My desc')
        self.assertEqual(j.ms_filename, u'F00346.mzxml')
        self.assertEqual(j.parentjobid, pid)
        self.assertEqual(j.state, u'RUNNING')
        self.assertEqual(j.created_at, created_at)
        self.assertEqual(j.launcher_url, url)

    def test_add(self):
        jid = uuid.UUID('986917b1-66a8-42c2-8f77-00be28793e58')
        j = user.JobMeta(jid, u'bob')
        user.JobMeta.add(j)

        self.assertEqual(self.session.query(user.JobMeta).count(), 1)

    def test_by_id(self):
        jid = uuid.UUID('986917b1-66a8-42c2-8f77-00be28793e58')
        job_in = user.JobMeta(jid, u'bob')
        user.JobMeta.add(job_in)

        job_out = user.JobMeta.by_id(jid)

        self.assertEqual(job_out, job_in)

    def test_delete(self):
        jid = uuid.UUID('986917b1-66a8-42c2-8f77-00be28793e58')
        job_in = user.JobMeta(jid, u'bob')
        user.JobMeta.add(job_in)

        user.JobMeta.delete(job_in)

        self.assertEqual(self.session.query(user.JobMeta).count(), 0)


class TestGetUser(unittest.TestCase):
    def setUp(self):
        self.config = testing.setUp()
        self.request = testing.DummyRequest()

    def tearDown(self):
        testing.tearDown()

    @patch('magmaweb.user.authenticated_userid')
    def test_it(self, uau):
        uau.return_value = u'bob'
        self.request.user = 'User.bob'

        rf = user.get_user(self.request)

        self.assertEqual(rf, 'User.bob')

    @patch('magmaweb.user.authenticated_userid')
    def test_unauth(self, uau):
        uau.return_value = None

        rf = user.get_user(self.request)

        self.assertIsNone(rf)


class TestGroupFinder(unittest.TestCase):
    def setUp(self):
        self.request = testing.DummyRequest()

    @patch('magmaweb.user.User.by_id')
    def test_it(self, bi):
        bi.return_value = 'User.bob'

        principals = user.groupfinder('bob', self.request)

        self.assertEqual(principals, [])

    @patch('magmaweb.user.User.by_id')
    def test_notindb(self, bi):
        bi.return_value = None

        principals = user.groupfinder('bob', self.request)

        self.assertIsNone(principals)


class TestRootFactory(unittest.TestCase):
    def setUp(self):
        self.config = testing.setUp()
        self.config.add_static_view('static', 'magmaweb:static')
        self.request = testing.DummyRequest()
        self.request.registry.settings = {'extjsroot': 'extjsroot'}

    def tearDown(self):
        testing.tearDown()

    def test_acl(self):
        rf = user.RootFactory(self.request)

        expected_acl = [
            (Allow, Authenticated, 'view'),
            (Deny, Everyone, ALL_PERMISSIONS)
        ]
        self.assertEqual(expected_acl, rf.__acl__)

    def test_extjsroot(self):
        rf = user.RootFactory(self.request)

        self.assertEqual(rf.request.extjsroot,
                         'http://example.com/static/extjsroot')


class TestJobIdFactory(unittest.TestCase):
    def setUp(self):
        self.config = testing.setUp()
        self.config.add_static_view('static', 'magmaweb:static')
        self.request = testing.DummyRequest()
        self.request.registry.settings = {'extjsroot': 'extjsroot',
                                          'jobfactory.root_dir': '/somedir',
                                          'monitor_user': 'jobmanager',
                                          }
        init_user_db()
        self.session = user.DBSession()
        u = user.User(u'me', u'My', u'myself')
        self.session.add(u)
        job_id = uuid.UUID('11111111-1111-1111-1111-111111111111')
        j = user.JobMeta(job_id, u'me', description=u'My job')
        self.session.add(j)

    def tearDown(self):
        destroy_user_db()
        testing.tearDown()

    def test_getPrivateJob(self):
        from magmaweb.job import Job
        mjob = Mock(Job)
        mjob.owner = u'bob'
        mjob.is_public = False
        jif = user.JobIdFactory(self.request)
        jif.job_factory.fromId = Mock(return_value=mjob)
        job_id = uuid.UUID('11111111-1111-1111-1111-111111111111')

        job = jif[str(job_id)]

        jif.job_factory.fromId.assert_called_once_with(job_id)
        self.assertEqual(job, mjob)
        self.assertEqual(job.__acl__, [(Allow, u'bob', ('run', 'view')),
                                       (Allow, u'jobmanager', 'monitor'),
                                       (Deny, Everyone, ALL_PERMISSIONS),
                                       ])

    def test_getPublicJob(self):
        from magmaweb.job import Job
        mjob = Mock(Job)
        mjob.owner = u'bob'
        mjob.is_public = True
        jif = user.JobIdFactory(self.request)
        jif.job_factory.fromId = Mock(return_value=mjob)
        job_id = uuid.UUID('11111111-1111-1111-1111-111111111111')

        job = jif[str(job_id)]

        jif.job_factory.fromId.assert_called_once_with(job_id)
        self.assertEqual(job, mjob)
        self.assertEqual(job.__acl__, [(Allow, Authenticated, 'view'),
                                       (Allow, u'bob', ('run', 'view')),
                                       (Allow, u'jobmanager', 'monitor'),
                                       (Deny, Everyone, ALL_PERMISSIONS),
                                       ])

    def test_getJobNotFound(self):
        from magmaweb.job import JobNotFound
        jobid = uuid.UUID('3ad25048-26f6-11e1-851e-00012e260790')
        jif = user.JobIdFactory(self.request)
        notfound = JobNotFound('Job not found', jobid)
        jif.job_factory.fromId = Mock(side_effect=notfound)

        with self.assertRaises(HTTPNotFound):
            jif[str(jobid)]
