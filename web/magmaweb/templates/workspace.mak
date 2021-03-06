<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>MAGMa - Workspace</title>
<link rel="stylesheet"
  href="${request.extjsroot}/resources/css/ext-all.css" type="text/css"></link>
<link rel="stylesheet" href="${request.static_url('magmaweb:static/style.css')}" type="text/css"/>
<script type="text/javascript" src="${request.extjsroot}/ext.js"></script>
<style type="text/css">

.icon-delete {
  background-image:
    url(${request.extjsroot}/examples/writer/images/delete.png) !important;
}
</style>
<script type="text/javascript">
Ext.Loader.setConfig({
  enabled: true,
//  disableCaching: false, // uncomment to use firebug breakpoints
  paths: {
    'Esc.magmaweb': '${request.static_url('magmaweb:static/app')}',
    'Esc': '${request.static_url('magmaweb:static/esc')}',
    'Ext.ux': '${request.extjsroot}/examples/ux'
  }
});

</script>
## Comment out below for development or when running sencha build, every
## class is loaded when commented out
<script type="text/javascript"
  src="${request.static_url('magmaweb:static/app/resultsApp-all.js')}"></script>
<script type="text/javascript">

Ext.require([
  'Ext.container.Viewport',
  'Ext.layout.container.Border',
  'Ext.toolbar.Spacer',
  'Ext.container.ButtonGroup',
  'Ext.form.Panel',
  'Ext.grid.Panel',
  'Ext.grid.column.Date',
  'Ext.grid.column.Boolean',
  'Ext.grid.column.Action',
  'Ext.grid.plugin.CellEditing',
  'Ext.data.proxy.Rest',
  'Ext.window.MessageBox'
]);

Ext.onReady(function() {
  Ext.QuickTips.init();

  <%!
  import json
  %>
  var authenticated = ${json.dumps(request.user is not None)};
  var anonymous = ${json.dumps(request.registry.settings.get('auto_register', False))|n};

  % if not request.registry.settings.get('auto_register', False):
  var access_token = Ext.create('Ext.button.Button', {
      text: 'Generate access token for web services',
      href: '${request.route_url('access_token')}'
  });

  var form = Ext.create('Ext.form.Panel', {
    title: 'User',
    items:[{
      xtype: 'displayfield',
      fieldLabel: 'User id',
      value: '${request.user.userid}'
    }, {
      xtype: 'textfield',
      fieldLabel: 'Name',
      width: 400,
      value: '${request.user.displayname}'
    }, {
      xtype: 'textfield',
      fieldLabel: 'Email',
      width: 400,
      value: '${request.user.email}',
      vtype: 'email'
    }],
    buttons: [{
      text: 'Update'
    }, access_token
    ]
  });
  % endif

  Ext.define('Job', {
      extend: 'Ext.data.Model',
      fields: [
        'id',
        'description',
        'ms_filename',
        {name: 'created_at', type: 'date'},
        'url',
        'is_public',
        'state',
        'size'
      ],
      proxy: {
        type: 'rest',
        url: '${request.route_path('jobfromscratch')}'
      }
  });

  var job_store = Ext.create('Ext.data.Store', {
    model: 'Job',
    sorters: {
        property: 'created_at',
        direction: 'DESC'
    },
    data: ${json.dumps(jobs)|n}
  });

  var cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
    clicksToEdit: 1
  });

  var job_grid = Ext.create('Ext.grid.Panel', {
    title: 'Jobs',
    store: job_store,
    height: 500,
    tools: [{
      type: 'help',
      handler: function() {
        window.open('${request.route_url('help')}#workspace', 'magmaHelp','width=700,height=500');
      }
    }],
    plugins: [cellEditing],
    listeners: {
      edit: function(editor, e) {
        e.record.save();
      }
    },
    columns: [{
      text: 'ID', dataIndex: 'id', renderer: function(v, m, r) {
        return Ext.String.format('<a href="{0}">{1}</a>', r.data.url, v);
      },
      width: 100
    }, {
      text: 'Description', dataIndex: 'description',
      flex: 2,
      editor: {
        xtype: 'textfield'
      }
    }, {
      text: 'MS filename', dataIndex: 'ms_filename',
      flex: 1,
      editor: {
        xtype: 'textfield'
      }
    }, {
      text: 'Public?', dataIndex: 'is_public', width: 70,
      xtype: 'booleancolumn',
      trueText: 'Public',
      falseText: 'Private',
      editor: {
        xtype: 'checkbox'
      }
    }, {
      text: 'State', dataIndex: 'state'
    }, {
      text: 'Created at', dataIndex: 'created_at', width: 120,
      xtype: 'datecolumn', format: "Y-m-d H:i:s"
    }, {
      text: 'Size', dataIndex: 'size', width: 60,
      renderer: Ext.util.Format.fileSize
    }, {
      xtype: 'actioncolumn',
      width:30,
      sortable: false,
      items: [{
        iconCls: 'icon-delete',
          tooltip: 'Delete Job',
          handler: function(grid, rowIndex, colIndex, item, e , row) {
            Ext.MessageBox.confirm(
              'Delete job',
              'Are you sure you want delete job '+row.data.id+'?',
              function(button) {
                if (button === 'yes') {
                  row.destroy();
                }
              }
            );
          }
      }]
    }]
  });

  var header = {
    border: false,
    region: 'north',
    layout: {
      type: 'hbox',
      align: 'middle',
      padding: 2
    },
    items: [{
      xtype: 'buttongroup',
      columns: 2,
      items: [{
        text: 'Home',
        href: "${request.route_url('home')}",
        hrefTarget: '_self'
      }, {
        text: 'Help',
        href: "${request.route_url('help')}"
      }, {
        text: 'Workspace',
        tooltip: 'My settings and jobs',
        disabled: true
      }, {
        text: 'Logout',
        href: "${request.route_url('logout')}",
        hrefTarget: '_self'
      }]
    }, {
      xtype:'tbspacer',
      flex:1 // aligns buttongroup right
    }, {
      xtype: 'component',
      cls: 'x-title',
      html: '<a href="." data-qtip="<b>M</b>s <b>A</b>nnotation based on in silico <b>G</b>enerated <b>M</b>et<b>a</b>bolites">MAGMa</a>'
    }, {
      xtype:'tbspacer',
      flex:1 // aligns buttongroup right
    }, {
      xtype: 'component',
      contentEl: 'logos'
    }]
  };

  Ext.create('Ext.container.Viewport', {
    layout: 'border',
    items: [header, {
      region: 'center',
      % if not request.registry.settings.get('auto_register', False):
      items: [form, job_grid],
      % else:
      items: [job_grid],
      % endif
      border: false,
      bodyPadding: 5,
      autoScroll: true,
      defaults: { bodyPadding: 5 }
    }]
  });

  function user_authenticated(authenticated, anonymous) {
      if (authenticated && anonymous) {
          // anonymous authenticated can not logout
          Ext.ComponentQuery.query('component[text=Logout]')[0].hide();
      }
    };

    user_authenticated(authenticated, anonymous);
});
</script>
</head>
<body>
<%include file="logos.mak"/>
</body>
</html>
